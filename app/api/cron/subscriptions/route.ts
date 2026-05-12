import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";
import { createHmac } from "crypto";

import { sendEmail } from "@/lib/send-email";
import SubscriptionExpiredEmail from "@/emails/SubscriptionExpiredEmail";
import SubscriptionNoticeEmail from "@/emails/SubscriptionNoticeEmail";

export const runtime = "nodejs";

type Tier = "free" | "basic" | "pro" | "elite";
type Interval = "monthly" | "annual";

type SubRow = {
  clerk_user_id: string;
  tier: string | null;
  status: string | null;
  expires_at: string | null;
  trial_ends_at?: string | null;
  interval?: string | null;
};

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

function normalizeTier(value: string | null | undefined): Tier {
  const v = String(value ?? "free").toLowerCase();
  if (v === "elite") return "elite";
  if (v === "pro") return "pro";
  if (v === "basic") return "basic";
  return "free";
}

function daysUntil(iso: string, now: Date) {
  const t = new Date(iso).getTime();
  return Math.floor((t - now.getTime()) / 86_400_000);
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeOneClickToken(payload: { userId: string; tier: Tier; interval: Interval }, secret: string) {
  const p = { ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 2 };
  const payloadPart = base64UrlEncode(Buffer.from(JSON.stringify(p), "utf8"));
  const sig = base64UrlEncode(createHmac("sha256", secret).update(payloadPart).digest());
  return `${payloadPart}.${sig}`;
}

async function hasLog(
  supabase: ReturnType<typeof createServiceClient>,
  job: string,
  userId: string,
  status: string,
) {
  try {
    const { data } = await supabase
      .from("cron_logs")
      .select("id")
      .eq("job", job)
      .eq("user_id", userId)
      .eq("status", status)
      .limit(1);
    return ((data as Array<{ id: string }> | null) ?? []).length > 0;
  } catch {
    return false;
  }
}

async function log(
  supabase: ReturnType<typeof createServiceClient>,
  job: string,
  userId: string,
  status: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from("cron_logs").insert({
      job,
      user_id: userId,
      status,
      details,
      created_at: new Date().toISOString(),
    });
  } catch {}
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization") || "";
    const given = request.headers.get("x-cron-secret") || "";
    if (authHeader !== `Bearer ${cronSecret}` && given !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const oneClickSecret = process.env.ONE_CLICK_PAYMENT_SECRET || "";

  let rows: SubRow[] = [];
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("clerk_user_id,tier,status,expires_at,trial_ends_at,interval")
      .limit(50_000);
    if (error) throw error;
    rows = (data as SubRow[] | null) ?? [];
  } catch {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("clerk_user_id,tier,status,expires_at")
      .limit(50_000);
    rows = (data as SubRow[] | null) ?? [];
  }

  const clerk = await clerkClient();

  let processed = 0;
  let sent = 0;
  let downgraded = 0;

  for (const r of rows) {
    const userId = String(r.clerk_user_id ?? "");
    if (!userId) continue;
    processed += 1;

    const status = String(r.status ?? "active").toLowerCase();
    const tier = normalizeTier(r.tier);

    const trialEnd = r.trial_ends_at ?? (status === "trialing" ? r.expires_at : null);
    const renewalAt = r.expires_at;

    let userEmail = "";
    let username = "Tipster";
    let currentPublic: Record<string, unknown> | null = null;
    try {
      const u = await clerk.users.getUser(userId);
      userEmail = u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || "";
      username = u.firstName || u.username || "Tipster";
      currentPublic = (u.publicMetadata ?? {}) as Record<string, unknown>;
    } catch {
      userEmail = "";
    }
    if (!userEmail) continue;

    if (status === "trialing" && trialEnd) {
      const d = daysUntil(trialEnd, now);

      if (d <= 0) {
        if (!(await hasLog(supabase, "subscriptions", userId, "trial_downgraded"))) {
          try {
            await supabase
              .from("user_subscriptions")
              .update({
                tier: "free",
                status: "expired",
                expires_at: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq("clerk_user_id", userId);
          } catch {}

          try {
            await clerk.users.updateUserMetadata(userId, {
              publicMetadata: {
                ...(currentPublic ?? {}),
                subscription: {
                  tier: "free",
                  status: "expired",
                  expiresAt: now.toISOString(),
                  trialEndsAt: null,
                },
              },
            });
          } catch {}

          await sendEmail({
            to: userEmail,
            subject: "Your TipLytic trial has ended",
            react: React.createElement(SubscriptionExpiredEmail, { username }),
          });
          await log(supabase, "subscriptions", userId, "trial_downgraded", { fromTier: tier });
          downgraded += 1;
          sent += 1;
        }
        continue;
      }

      if (d === 3) {
        if (await hasLog(supabase, "subscriptions", userId, "trial_3d")) continue;
        await sendEmail({
          to: userEmail,
          subject: "Your trial ends in 3 days",
          react: React.createElement(SubscriptionNoticeEmail, {
            preview: "Your trial ends soon",
            title: "Your trial ends in 3 days",
            username,
            lines: [
              "You’re currently on a free trial with full access to your tier features.",
              "Add payment now to continue without interruption.",
            ],
            ctaLabel: "Manage subscription",
            ctaUrl: `${appUrl}/dashboard/subscription`,
          }),
        });
        await log(supabase, "subscriptions", userId, "trial_3d", { trialEnd });
        sent += 1;
      }

      if (d === 1) {
        if (await hasLog(supabase, "subscriptions", userId, "trial_1d")) continue;
        const token = oneClickSecret
          ? makeOneClickToken(
              { userId, tier: tier === "free" ? "basic" : tier, interval: "monthly" },
              oneClickSecret,
            )
          : "";
        const payUrl = token ? `${appUrl}/api/payments/one-click?token=${encodeURIComponent(token)}` : `${appUrl}/pricing`;

        await sendEmail({
          to: userEmail,
          subject: "Your trial ends tomorrow",
          react: React.createElement(SubscriptionNoticeEmail, {
            preview: "Trial ending tomorrow",
            title: "Your trial ends tomorrow",
            username,
            lines: [
              "Your free trial ends in 24 hours.",
              "Continue your plan with one click to avoid losing premium access.",
            ],
            ctaLabel: "Continue with payment",
            ctaUrl: payUrl,
          }),
        });
        await log(supabase, "subscriptions", userId, "trial_1d", { trialEnd, payUrl: token ? "one-click" : "pricing" });
        sent += 1;
      }
      continue;
    }

    if (status === "active" && tier !== "free" && renewalAt) {
      const d = daysUntil(renewalAt, now);
      if (d === 7) {
        if (await hasLog(supabase, "subscriptions", userId, "renew_7d")) continue;
        await sendEmail({
          to: userEmail,
          subject: "Your subscription renews in 7 days",
          react: React.createElement(SubscriptionNoticeEmail, {
            preview: "Renewal in 7 days",
            title: "Your subscription renews in 7 days",
            username,
            lines: [
              `Your ${tier.toUpperCase()} plan is set to renew soon.`,
              "No action is needed if you want to keep premium access.",
            ],
            ctaLabel: "View subscription",
            ctaUrl: `${appUrl}/dashboard/subscription`,
          }),
        });
        await log(supabase, "subscriptions", userId, "renew_7d", { renewalAt });
        sent += 1;
      }
      if (d === 3) {
        if (await hasLog(supabase, "subscriptions", userId, "renew_3d")) continue;
        await sendEmail({
          to: userEmail,
          subject: "Renewal reminder",
          react: React.createElement(SubscriptionNoticeEmail, {
            preview: "Renewal reminder",
            title: "Renewal reminder",
            username,
            lines: [
              `Your ${tier.toUpperCase()} plan renews in 3 days.`,
              "Make sure your payment method is ready to avoid interruption.",
            ],
            ctaLabel: "Manage subscription",
            ctaUrl: `${appUrl}/dashboard/subscription`,
          }),
        });
        await log(supabase, "subscriptions", userId, "renew_3d", { renewalAt });
        sent += 1;
      }
      if (d === 0) {
        if (await hasLog(supabase, "subscriptions", userId, "renew_today")) continue;
        await sendEmail({
          to: userEmail,
          subject: "Renewing today — here's your last week in review",
          react: React.createElement(SubscriptionNoticeEmail, {
            preview: "Renewing today",
            title: "Renewing today",
            username,
            lines: [
              "Your subscription renews today.",
              "If you’ve been on a streak lately, keep it going — your stats are waiting in the dashboard.",
            ],
            ctaLabel: "See full stats",
            ctaUrl: `${appUrl}/dashboard`,
          }),
        });
        await log(supabase, "subscriptions", userId, "renew_today", { renewalAt });
        sent += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, processed, sent, downgraded });
}
