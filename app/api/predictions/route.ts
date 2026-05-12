import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import {
  canAccessTier,
  canSeeAdminAnalysis,
  canSeeConfidenceScore,
  getDailyPredictionLimit,
} from "@/lib/tier-access";

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type DbPrediction = Record<string, unknown> & {
  id: string | number;
  tier_required?: string | null;
  confidence_score?: number | null;
  confidence?: number | null;
  admin_analysis?: string | null;
  is_admin_pick?: boolean | null;
};

export async function GET(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const shouldCount = url.searchParams.get("count") !== "0";

  const supabase = createServiceClient();

  let userTier = tierFromClaims(sessionClaims) ?? "free";
  if (userTier === "free") {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("tier")
      .eq("clerk_user_id", userId)
      .maybeSingle<{ tier: string }>();
    if (!error && data?.tier) userTier = normalizeTier(data.tier);
  }

  if (userTier === "free") {
    try {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
      const sub = meta.subscription as Record<string, unknown> | null;
      if (sub) userTier = normalizeTier(sub.tier);
    } catch {}
  }

  const limit = getDailyPredictionLimit(userTier);
  const day = todayKey();

  let alreadyViewed = 0;
  try {
    const { data } = await supabase
      .from("prediction_views")
      .select("count")
      .eq("clerk_user_id", userId)
      .eq("view_date", day)
      .maybeSingle<{ count: number }>();
    alreadyViewed = data?.count ?? 0;
  } catch {}

  const remaining = Number.isFinite(limit) ? Math.max(0, limit - alreadyViewed) : Infinity;
  const limitReached = Number.isFinite(limit) ? remaining <= 0 : false;

  if (limitReached) {
    return NextResponse.json({
      predictions: [],
      tier: userTier,
      dailyLimit: limit,
      remaining: 0,
      limitReached: true,
    });
  }

  const { data: rows, error } = await supabase
    .from("predictions")
    .select("*")
    .order("is_admin_pick", { ascending: false })
    .order("match_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accessible = (rows as DbPrediction[]).filter((p) =>
    canAccessTier(userTier, p.tier_required ?? "free"),
  );

  const sliced =
    Number.isFinite(limit) && Number.isFinite(remaining)
      ? accessible.slice(0, remaining)
      : accessible;

  const allowConfidence = canSeeConfidenceScore(userTier);
  const allowAdmin = canSeeAdminAnalysis(userTier);

  const sanitized = sliced.map((p) => {
    const out: Record<string, unknown> = { ...p };

    const confidence =
      typeof p.confidence_score === "number"
        ? p.confidence_score
        : typeof p.confidence === "number"
          ? p.confidence
          : null;
    out.confidence = allowConfidence ? confidence : null;

    delete out.confidence_score;

    if (!allowAdmin) {
      delete out.admin_analysis;
    }

    if (!allowAdmin) {
      delete out.admin_rating;
      delete out.admin_wins;
      delete out.admin_losses;
      delete out.admin_void;
    }

    if (!allowAdmin) {
      out.is_admin_pick = Boolean(p.is_admin_pick);
    }

    return out;
  });

  try {
    if (shouldCount && Number.isFinite(limit)) {
      const incrementBy = sanitized.length;
      await supabase.from("prediction_views").upsert(
        {
          clerk_user_id: userId,
          view_date: day,
          count: alreadyViewed + incrementBy,
        },
        { onConflict: "clerk_user_id,view_date" },
      );
    }
  } catch {}

  const nextRemaining =
    Number.isFinite(limit) ? Math.max(0, limit - (alreadyViewed + sanitized.length)) : Infinity;

  return NextResponse.json({
    predictions: sanitized,
    tier: userTier,
    dailyLimit: limit,
    remaining: Number.isFinite(nextRemaining) ? nextRemaining : null,
    limitReached: Number.isFinite(limit) ? nextRemaining <= 0 : false,
  });
}
