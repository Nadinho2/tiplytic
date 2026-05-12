import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTier(value: unknown) {
  const t = String(value ?? "").toLowerCase();
  if (t === "elite") return "elite";
  if (t === "pro") return "pro";
  if (t === "basic") return "basic";
  return "free";
}

function subscriptionFromClaims(claims: unknown) {
  if (!isRecord(claims)) return null;
  const publicMetadata = isRecord(claims.publicMetadata)
    ? claims.publicMetadata
    : isRecord(claims.public_metadata)
      ? claims.public_metadata
      : null;
  if (!publicMetadata || !isRecord(publicMetadata)) return null;
  const sub = isRecord(publicMetadata.subscription) ? publicMetadata.subscription : null;
  if (!sub) return null;
  const tier = normalizeTier(sub.tier);
  const status = String(sub.status ?? "active");
  const expires_at =
    typeof sub.expiresAt === "string"
      ? sub.expiresAt
      : typeof sub.expires_at === "string"
        ? sub.expires_at
        : null;
  return { tier, status, expires_at };
}

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("tier,status,expires_at")
    .eq("clerk_user_id", userId)
    .maybeSingle<{ tier: string | null; status: string | null; expires_at: string | null }>();

  if (error) {
    const fromClaims = subscriptionFromClaims(sessionClaims);
    if (fromClaims) return NextResponse.json(fromClaims);

    try {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
      const sub = (meta.subscription as Record<string, unknown> | null) ?? null;
      if (sub) {
        return NextResponse.json({
          tier: normalizeTier(sub.tier),
          status: String(sub.status ?? "active"),
          expires_at:
            typeof sub.expiresAt === "string"
              ? sub.expiresAt
              : typeof sub.expires_at === "string"
                ? sub.expires_at
                : null,
        });
      }
    } catch {}
  }

  return NextResponse.json({
    tier: data?.tier ?? "free",
    status: data?.status ?? "active",
    expires_at: data?.expires_at ?? null,
  });
}
