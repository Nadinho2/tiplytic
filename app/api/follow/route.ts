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

type Body = { targetUserId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTier(value: unknown) {
  const t = String(value ?? "").toLowerCase();
  return t === "elite" ? "elite" : t === "pro" ? "pro" : t === "basic" ? "basic" : "free";
}

function tierFromClaims(claims: unknown) {
  if (!isRecord(claims)) return null;
  const publicMetadata = isRecord(claims.publicMetadata)
    ? claims.publicMetadata
    : isRecord(claims.public_metadata)
      ? claims.public_metadata
      : null;
  if (!publicMetadata || !isRecord(publicMetadata)) return null;
  const sub = isRecord(publicMetadata.subscription) ? publicMetadata.subscription : null;
  if (!sub) return null;
  return normalizeTier(sub.tier);
}

async function getTier(userId: string, sessionClaims: unknown) {
  const fromClaims = tierFromClaims(sessionClaims);
  if (fromClaims) return fromClaims;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("tier")
    .eq("clerk_user_id", userId)
    .maybeSingle<{ tier: string }>();
  if (!error && data?.tier) return normalizeTier(data.tier);

  try {
    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
    const sub = meta.subscription as Record<string, unknown> | null;
    if (sub) return normalizeTier(sub.tier);
  } catch {}

  return "free";
}

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getTier(userId, sessionClaims);
  if (tier !== "pro" && tier !== "elite") {
    return NextResponse.json({ error: "Follow is a Pro/Elite feature" }, { status: 403 });
  }

  const body = (await request.json()) as Body;
  const targetUserId = String(body.targetUserId || "").trim();
  if (!targetUserId) return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
  if (targetUserId === userId) return NextResponse.json({ error: "Invalid targetUserId" }, { status: 400 });

  const supabase = createServiceClient();

  try {
    await supabase.from("follows").upsert(
      {
        follower_id: userId,
        following_id: targetUserId,
        created_at: new Date().toISOString(),
      },
      { onConflict: "follower_id,following_id", ignoreDuplicates: true },
    );

    try {
      await supabase.from("notifications").insert({
        user_id: targetUserId,
        type: "follow",
        message: "You have a new follower.",
        created_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ ok: true, following: true });
  } catch {
    return NextResponse.json(
      { error: "Follow system not configured (missing follows table)" },
      { status: 501 },
    );
  }
}

export async function DELETE(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getTier(userId, sessionClaims);
  if (tier !== "pro" && tier !== "elite") {
    return NextResponse.json({ error: "Follow is a Pro/Elite feature" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const targetUserId = String(body.targetUserId || "").trim();
  if (!targetUserId) return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });

  const supabase = createServiceClient();

  try {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", targetUserId);
    return NextResponse.json({ ok: true, following: false });
  } catch {
    return NextResponse.json(
      { error: "Follow system not configured (missing follows table)" },
      { status: 501 },
    );
  }
}
