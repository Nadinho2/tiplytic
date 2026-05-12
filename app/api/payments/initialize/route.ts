import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

type Tier = "basic" | "pro" | "elite";
type Interval = "monthly" | "annual";

type Body = {
  tier?: string;
  interval?: string;
  trial?: boolean;
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

function isTier(v: string): v is Tier {
  return v === "basic" || v === "pro" || v === "elite";
}

function isInterval(v: string): v is Interval {
  return v === "monthly" || v === "annual";
}

function amountFor(tier: Tier, interval: Interval) {
  const monthly = tier === "basic" ? 2500 : tier === "pro" ? 5000 : 10000;
  const annual = tier === "basic" ? 25000 : tier === "pro" ? 50000 : 100000;
  return interval === "annual" ? annual : monthly;
}

function planEnvKey(tier: Tier, interval: Interval) {
  const t = tier.toUpperCase();
  const i = interval.toUpperCase();
  return `PAYSTACK_PLAN_${t}_${i}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const tierRaw = String(body.tier ?? "").toLowerCase();
  const intervalRaw = String(body.interval ?? "monthly").toLowerCase();
  const trial = Boolean(body.trial);

  if (!isTier(tierRaw)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  if (!isInterval(intervalRaw)) return NextResponse.json({ error: "Invalid interval" }, { status: 400 });

  const supabase = createServiceClient();

  if (trial) {
    if (tierRaw !== "basic" && tierRaw !== "pro") {
      return NextResponse.json({ error: "Trials are only available for Basic and Pro" }, { status: 400 });
    }

    try {
      const { data } = await supabase
        .from("payments")
        .select("id,status")
        .eq("user_id", userId)
        .eq("tier", tierRaw)
        .in("status", ["trial", "success"])
        .limit(1);
      if ((data as Array<{ id: string }> | null)?.length) {
        return NextResponse.json({ error: "You have already used a trial for this tier" }, { status: 409 });
      }
    } catch {}

    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 7);

    try {
      await supabase.from("payments").insert({
        user_id: userId,
        tier: tierRaw,
        interval: "trial",
        amount: 0,
        status: "trial",
        reference: `trial_${tierRaw}_${userId}_${Date.now()}`,
        created_at: now.toISOString(),
      });
    } catch {}

    const iso = expires.toISOString();
    const rowWithTrial = {
      clerk_user_id: userId,
      tier: tierRaw,
      status: "trialing",
      trial_ends_at: iso,
      expires_at: iso,
      updated_at: now.toISOString(),
      interval: "trial",
    } as Record<string, unknown>;

    const rowWithoutTrial = {
      clerk_user_id: userId,
      tier: tierRaw,
      status: "trialing",
      expires_at: iso,
      updated_at: now.toISOString(),
    } as Record<string, unknown>;

    const r1 = await supabase.from("user_subscriptions").upsert(rowWithTrial as never, { onConflict: "clerk_user_id" });
    if (r1.error) {
      await supabase.from("user_subscriptions").upsert(rowWithoutTrial as never, { onConflict: "clerk_user_id" });
    }

    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const current = (user.publicMetadata ?? {}) as Record<string, unknown>;
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...current,
          subscription: {
            tier: tierRaw,
            status: "trialing",
            expiresAt: iso,
            trialEndsAt: iso,
            interval: "trial",
          },
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      mode: "trial",
      redirectUrl: "/dashboard/subscription?trial=true",
    });
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email =
    user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
  if (!email) return NextResponse.json({ error: "No email for user" }, { status: 400 });

  const amount = amountFor(tierRaw, intervalRaw);
  const planCode = process.env[planEnvKey(tierRaw, intervalRaw)] || null;
  if (!planCode) {
    return NextResponse.json(
      { error: `Missing Paystack plan env: ${planEnvKey(tierRaw, intervalRaw)}` },
      { status: 500 },
    );
  }

  const paystackSecret = requiredEnv("PAYSTACK_SECRET_KEY");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callback_url = `${baseUrl}/dashboard/subscription?paystack=1`;

  const reference = `tiplytic_${userId}_${Date.now()}`;
  const payload = {
    email,
    amount: amount * 100,
    reference,
    callback_url,
    plan: planCode,
    metadata: {
      clerk_user_id: userId,
      tier: tierRaw,
      interval: intervalRaw,
    },
  };

  const resp = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await resp.json().catch(() => null)) as
    | { status: boolean; message?: string; data?: { authorization_url: string; reference: string } }
    | null;

  if (!resp.ok || !json?.status || !json.data?.authorization_url) {
    return NextResponse.json(
      { error: json?.message || "Failed to initialize Paystack transaction" },
      { status: 400 },
    );
  }

  try {
    await supabase.from("payments").insert({
      user_id: userId,
      email,
      tier: tierRaw,
      interval: intervalRaw,
      amount,
      status: "pending",
      reference: json.data.reference || reference,
      created_at: new Date().toISOString(),
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    mode: "checkout",
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
  });
}
