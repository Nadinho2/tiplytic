import "server-only";

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

type Tier = "basic" | "pro" | "elite";
type Interval = "monthly" | "annual";

type TokenPayload = {
  userId: string;
  tier: Tier;
  interval: Interval;
  exp: number;
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
  return `PAYSTACK_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}`;
}

function base64UrlDecode(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(s, "base64").toString("utf8");
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export async function GET(request: Request) {
  const secret = requiredEnv("ONE_CLICK_PAYMENT_SECRET");
  const paystackSecret = requiredEnv("PAYSTACK_SECRET_KEY");

  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") ?? "");
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const expectedSig = base64UrlEncode(createHmac("sha256", secret).update(payloadPart).digest());
  if (!safeEqual(sigPart, expectedSig)) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const payloadRaw = base64UrlDecode(payloadPart);
  const payload = (JSON.parse(payloadRaw) as Partial<TokenPayload>) || {};
  const userId = String(payload.userId ?? "");
  const tier = String(payload.tier ?? "").toLowerCase();
  const interval = String(payload.interval ?? "").toLowerCase();
  const exp = Number(payload.exp ?? 0);

  if (!userId || !isTier(tier) || !isInterval(interval) || !Number.isFinite(exp)) {
    return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
  }
  if (Math.floor(Date.now() / 1000) > exp) return NextResponse.json({ error: "Token expired" }, { status: 410 });

  const planCode = process.env[planEnvKey(tier, interval)] || null;
  if (!planCode) return NextResponse.json({ error: `Missing plan ${planEnvKey(tier, interval)}` }, { status: 500 });

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
  if (!email) return NextResponse.json({ error: "No email for user" }, { status: 400 });

  const amount = amountFor(tier, interval);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callback_url = `${baseUrl}/dashboard/subscription?paystack=1`;
  const reference = `tiplytic_${userId}_${Date.now()}`;

  const resp = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amount * 100,
      reference,
      callback_url,
      plan: planCode,
      metadata: { clerk_user_id: userId, tier, interval },
    }),
  });

  const json = (await resp.json().catch(() => null)) as
    | { status: boolean; message?: string; data?: { authorization_url: string; reference: string } }
    | null;

  if (!resp.ok || !json?.status || !json.data?.authorization_url) {
    return NextResponse.json({ error: json?.message || "Failed to initialize transaction" }, { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    await supabase.from("payments").insert({
      user_id: userId,
      email,
      tier,
      interval,
      amount,
      status: "pending",
      reference: json.data.reference || reference,
      created_at: new Date().toISOString(),
    });
  } catch {}

  return NextResponse.redirect(json.data.authorization_url, { status: 307 });
}
