import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";

import { sendEmail } from "@/lib/send-email";
import WelcomeEmail from "@/emails/WelcomeEmail";
import SubscriptionExpiredEmail from "@/emails/SubscriptionExpiredEmail";
import PaymentFailedEmail from "@/emails/PaymentFailedEmail";
import { checkAndAwardBadges } from "@/lib/badge-checker";

export const runtime = "nodejs";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createServiceClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function addDays(d: Date, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

function safeEqualHex(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export async function POST(request: Request) {
  const secret = requiredEnv("PAYSTACK_SECRET_KEY");
  const signature = request.headers.get("x-paystack-signature") || "";

  const rawBody = await request.text();
  const digest = createHmac("sha512", secret).update(rawBody).digest("hex");
  if (!signature || !safeEqualHex(signature, digest)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = (JSON.parse(rawBody) as Record<string, unknown>) || {};
  const eventType = String(event.event ?? "");
  const data = (event.data ?? {}) as Record<string, unknown>;

  const supabase = createServiceClient();

  if (eventType === "charge.success") {
    const reference = String(data.reference ?? "");
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    const clerkUserId = String(metadata.clerk_user_id ?? "");
    const tier = String(metadata.tier ?? "").toLowerCase();
    const interval = String(metadata.interval ?? "monthly").toLowerCase();

    if (reference) {
      try {
        await supabase
          .from("payments")
          .update({
            status: "success",
            paid_at: new Date().toISOString(),
          })
          .eq("reference", reference);
      } catch {}
    }

    if (clerkUserId && (tier === "basic" || tier === "pro" || tier === "elite")) {
      const now = new Date();
      const expires =
        interval === "annual" ? addDays(now, 365) : addDays(now, 30);

      const customer = (data.customer ?? {}) as Record<string, unknown>;
      const customerCode = customer.customer_code ? String(customer.customer_code) : null;
      const subscriptionCode =
        (data.subscription as Record<string, unknown> | undefined)?.subscription_code
          ? String((data.subscription as Record<string, unknown>).subscription_code)
          : (data.subscription_code ? String(data.subscription_code) : null);

      try {
        const rowWithExtras = {
          clerk_user_id: clerkUserId,
          tier,
          status: "active",
          interval,
          trial_ends_at: null,
          expires_at: expires.toISOString(),
          paystack_customer_code: customerCode,
          paystack_subscription_code: subscriptionCode,
          updated_at: now.toISOString(),
        } as Record<string, unknown>;

        const rowBasic = {
          clerk_user_id: clerkUserId,
          tier,
          status: "active",
          expires_at: expires.toISOString(),
          updated_at: now.toISOString(),
        } as Record<string, unknown>;

        const r1 = await supabase.from("user_subscriptions").upsert(rowWithExtras as never, { onConflict: "clerk_user_id" });
        if (r1.error) {
          await supabase.from("user_subscriptions").upsert(rowBasic as never, { onConflict: "clerk_user_id" });
        }
      } catch {}

      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(clerkUserId);
        try {
          const current = (user.publicMetadata ?? {}) as Record<string, unknown>;
          await clerk.users.updateUserMetadata(clerkUserId, {
            publicMetadata: {
              ...current,
              subscription: {
                tier,
                status: "active",
                expiresAt: expires.toISOString(),
                trialEndsAt: null,
                interval,
              },
            },
          });
        } catch {}
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          await sendEmail({
            to: email,
            subject: "Welcome to TipLytic!",
            react: React.createElement(WelcomeEmail, {
              username: user.firstName || user.username || "Tipster",
            }),
          });
        }
      } catch {}

      try {
        await checkAndAwardBadges(clerkUserId);
      } catch {}
    }

    return NextResponse.json({ ok: true });
  }

  if (eventType === "charge.failed") {
    const reference = String(data.reference ?? "");
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    const clerkUserId = String(metadata.clerk_user_id ?? "");

    if (reference) {
      try {
        await supabase
          .from("payments")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("reference", reference);
      } catch {}
    }

    try {
      if (clerkUserId) {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(clerkUserId);
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          const authorization = (data.authorization ?? {}) as Record<string, unknown>;
          const lastFour = authorization.last4 ? String(authorization.last4) : "—";
          const amountKobo = typeof data.amount === "number" ? data.amount : null;
          const amount = amountKobo ? `₦${Math.round(amountKobo / 100).toLocaleString()}` : "₦—";

          await sendEmail({
            to: email,
            subject: "Payment failed — update your card",
            react: React.createElement(PaymentFailedEmail, {
              username: user.firstName || user.username || "Tipster",
              amount,
              lastFour,
            }),
          });
        }
      }
    } catch {}

    return NextResponse.json({ ok: true });
  }

  if (eventType === "subscription.disable") {
    const subscriptionCode = String(data.subscription_code ?? "");
    const customer = (data.customer ?? {}) as Record<string, unknown>;
    const customerCode = customer.customer_code ? String(customer.customer_code) : "";
    const clerkUserId = String((data.metadata as Record<string, unknown> | undefined)?.clerk_user_id ?? "");

    try {
      let q = supabase.from("user_subscriptions").update({
        status: "expired",
        tier: "free",
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (subscriptionCode) q = q.eq("paystack_subscription_code", subscriptionCode);
      else if (customerCode) q = q.eq("paystack_customer_code", customerCode);
      else if (clerkUserId) q = q.eq("clerk_user_id", clerkUserId);
      await q;
    } catch {}

    try {
      const clerk = await clerkClient();
      const id = clerkUserId;
      if (id) {
        const user = await clerk.users.getUser(id);
        try {
          const current = (user.publicMetadata ?? {}) as Record<string, unknown>;
          await clerk.users.updateUserMetadata(id, {
            publicMetadata: {
              ...current,
              subscription: {
                tier: "free",
                status: "expired",
                expiresAt: new Date().toISOString(),
                trialEndsAt: null,
              },
            },
          });
        } catch {}
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          await sendEmail({
            to: email,
            subject: "Your TipLytic subscription has expired",
            react: React.createElement(SubscriptionExpiredEmail, {
              username: user.firstName || user.username || "Tipster",
            }),
          });
        }
      }
    } catch {}

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
