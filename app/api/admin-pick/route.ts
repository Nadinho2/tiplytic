import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { canSeeAdminAnalysis } from "@/lib/tier-access";

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

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfTomorrowIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
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

async function getUserTier(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  sessionClaims: unknown,
) {
  const fromClaims = tierFromClaims(sessionClaims);
  if (fromClaims) return fromClaims;

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

type AdminPickStatsRow = {
  total_picks: number;
  total_wins: number;
  total_losses: number;
  current_streak: number;
  best_streak: number;
  updated_at: string;
};

type PredictionRow = {
  id: string | number;
  is_admin_pick?: boolean | null;
  match_date?: string | null;
  result?: string | null;
  admin_analysis?: string | null;
  admin_rating?: number | null;
  admin_stars?: number | null;
  admin_wins?: number | null;
  admin_losses?: number | null;
  admin_void?: number | null;
} & Record<string, unknown>;

export async function GET() {
  const supabase = createServiceClient();

  const start = startOfTodayIso();
  const end = startOfTomorrowIso();

  const { data: picks } = await supabase
    .from("predictions")
    .select("*")
    .eq("is_admin_pick", true)
    .gte("match_date", start)
    .lt("match_date", end)
    .order("match_date", { ascending: true })
    .limit(1);

  const pick: PredictionRow | null = (picks?.[0] as PredictionRow | undefined) ?? null;

  const { data: statsRows } = await supabase
    .from("admin_pick_stats")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  const stats: AdminPickStatsRow | null =
    (statsRows?.[0] as AdminPickStatsRow | undefined) ?? null;

  const { data: lastRows } = await supabase
    .from("predictions")
    .select("result")
    .eq("is_admin_pick", true)
    .neq("result", "pending")
    .order("match_date", { ascending: false })
    .limit(5);

  const last5 = (lastRows ?? [])
    .map((r) => String((r as { result?: unknown }).result ?? "").toLowerCase())
    .filter((v) => v === "win" || v === "loss" || v === "void");

  const { userId, sessionClaims } = await auth();
  const tier = userId ? await getUserTier(supabase, userId, sessionClaims) : "free";
  const allowAdmin = canSeeAdminAnalysis(tier);

  if (pick && !allowAdmin) {
    delete pick.admin_analysis;
    delete pick.admin_rating;
    delete pick.admin_stars;
    delete pick.admin_wins;
    delete pick.admin_losses;
    delete pick.admin_void;
  }

  return NextResponse.json({ pick, stats, last5 });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId || userId !== adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const body = (await request.json()) as Record<string, unknown>;
  const id = body.id as string | number | undefined;

  const payload = { ...body, is_admin_pick: true };

  if (id) {
    const { data, error } = await supabase
      .from("predictions")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pick: data });
  }

  const { data, error } = await supabase.from("predictions").insert(payload).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pick: data });
}

export async function PUT(request: Request) {
  return POST(request);
}
