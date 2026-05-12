import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { calculateStreak } from "@/lib/stats-engine";
import { getTipsterRank } from "@/lib/tipster-ranks";

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

type Period = "week" | "month" | "all";
type Sort = "win_rate" | "roi" | "total_picks" | "streak";

function parsePeriod(v: string | null): Period {
  if (v === "week" || v === "month" || v === "all") return v;
  return "month";
}

function parseSort(v: string | null): Sort {
  if (v === "win_rate" || v === "roi" || v === "total_picks" || v === "streak") return v;
  return "win_rate";
}

function cutoffForPeriod(period: Period) {
  if (period === "all") return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (period === "week" ? 7 : 30));
  return d.toISOString();
}

function toUsername(u: { username: string | null; firstName: string | null; lastName: string | null }) {
  const base = u.username || [u.firstName, u.lastName].filter(Boolean).join("").toLowerCase();
  return base || null;
}

function clampNumber(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const sort = parseSort(url.searchParams.get("sort"));

  const supabase = createServiceClient();

  const { userId, sessionClaims } = await auth();
  let viewerTier: "free" | "basic" | "pro" | "elite" = tierFromClaims(sessionClaims) ?? "free";
  if (userId) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("tier")
      .eq("clerk_user_id", userId)
      .maybeSingle<{ tier: string }>();
    if (!error && data?.tier) viewerTier = normalizeTier(data.tier);
  }

  if (viewerTier === "free" && userId) {
    try {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
      const sub = meta.subscription as Record<string, unknown> | null;
      if (sub) viewerTier = normalizeTier(sub.tier);
    } catch {}
  }

  const isPaid = viewerTier !== "free";

  let totalTipsters = 0;
  let baseRows: Array<{
    user_id: string;
    total_picks: number;
    wins: number;
    losses: number;
    win_rate: number;
  }> = [];

  try {
    const { count } = await supabase
      .from("tipster_leaderboard")
      .select("*", { count: "exact", head: true });
    totalTipsters = count ?? 0;
  } catch {}

  try {
    const { data, error } = await supabase
      .from("tipster_leaderboard")
      .select("user_id,total_picks,wins,losses,win_rate")
      .order("win_rate", { ascending: false })
      .limit(500);
    if (error) throw error;
    baseRows = (data as typeof baseRows | null) ?? [];
  } catch {
    const { data } = await supabase
      .from("community_predictions")
      .select("user_id,result,odds")
      .gte("odds", 1.5)
      .order("created_at", { ascending: false })
      .limit(50_000);
    const rows =
      (data as Array<{ user_id: string; result: string | null; odds: number | string | null }> | null) ??
      [];

    const map = new Map<string, { wins: number; losses: number; total: number }>();
    for (const r of rows) {
      const res = (r.result ?? "").toLowerCase();
      if (res !== "win" && res !== "loss") continue;
      const cur = map.get(r.user_id) ?? { wins: 0, losses: 0, total: 0 };
      if (res === "win") cur.wins += 1;
      if (res === "loss") cur.losses += 1;
      cur.total += 1;
      map.set(r.user_id, cur);
    }
    baseRows = Array.from(map.entries())
      .map(([user_id, v]) => ({
        user_id,
        total_picks: v.total,
        wins: v.wins,
        losses: v.losses,
        win_rate: v.total > 0 ? Math.round(((v.wins / v.total) * 100) * 10) / 10 : 0,
      }))
      .filter((r) => r.total_picks >= 10)
      .sort((a, b) => b.win_rate - a.win_rate)
      .slice(0, 500);
    totalTipsters = totalTipsters || baseRows.length;
  }

  const userIds = baseRows.map((r) => r.user_id).slice(0, 200);

  const cutoff = cutoffForPeriod(period);
  const { data: preds } = await supabase
    .from("community_predictions")
    .select("user_id,created_at,result,profit_loss,stake,odds")
    .in("user_id", userIds)
    .gte("odds", 1.5)
    .gte("created_at", cutoff ?? "1970-01-01T00:00:00.000Z")
    .order("created_at", { ascending: false })
    .limit(50_000);

  const periodRows =
    (preds as Array<{
      user_id: string;
      created_at: string | null;
      result: string | null;
      profit_loss: number | null;
      stake: number | null;
      odds: number | string | null;
    }> | null) ?? [];

  const perUserPeriod = new Map<
    string,
    {
      total: number;
      wins: number;
      losses: number;
      profit: number;
      staked: number;
    }
  >();

  for (const r of periodRows) {
    const res = (r.result ?? "").toLowerCase();
    if (res !== "win" && res !== "loss") continue;
    const cur = perUserPeriod.get(r.user_id) ?? {
      total: 0,
      wins: 0,
      losses: 0,
      profit: 0,
      staked: 0,
    };
    cur.total += 1;
    if (res === "win") cur.wins += 1;
    if (res === "loss") cur.losses += 1;
    cur.profit += r.profit_loss ?? 0;
    cur.staked += r.stake ?? 0;
    perUserPeriod.set(r.user_id, cur);
  }

  const { data: roiRows } = await supabase
    .from("community_predictions")
    .select("user_id,result,profit_loss,stake")
    .in("user_id", userIds)
    .gte("odds", 1.5)
    .order("created_at", { ascending: false })
    .limit(50_000);

  const allFinance =
    (roiRows as Array<{
      user_id: string;
      result: string | null;
      profit_loss: number | null;
      stake: number | null;
    }> | null) ?? [];

  const roiAllByUser = new Map<string, number>();
  const sums = new Map<string, { profit: number; staked: number }>();
  for (const r of allFinance) {
    const res = (r.result ?? "").toLowerCase();
    if (res !== "win" && res !== "loss") continue;
    const cur = sums.get(r.user_id) ?? { profit: 0, staked: 0 };
    cur.profit += r.profit_loss ?? 0;
    cur.staked += r.stake ?? 0;
    sums.set(r.user_id, cur);
  }
  for (const [uid, v] of sums.entries()) {
    roiAllByUser.set(uid, v.staked > 0 ? (v.profit / v.staked) * 100 : 0);
  }

  const { data: streakRows } = await supabase
    .from("community_predictions")
    .select("user_id,created_at,result")
    .in("user_id", userIds)
    .gte("odds", 1.5)
    .order("created_at", { ascending: false })
    .limit(50_000);

  const allStreakRows =
    (streakRows as Array<{ user_id: string; created_at: string | null; result: string | null }> | null) ?? [];

  const streakByUser = new Map<
    string,
    { current: number; best: number }
  >();

  const bucket = new Map<string, Array<{ created_at: string | null; result: string | null }>>();
  for (const r of allStreakRows) {
    const arr = bucket.get(r.user_id) ?? [];
    if (arr.length < 500) arr.push({ created_at: r.created_at, result: r.result });
    bucket.set(r.user_id, arr);
  }
  for (const [uid, arr] of bucket.entries()) {
    const streak = calculateStreak(
      arr.map((p, idx) => ({
        id: idx,
        user_id: uid,
        created_at: p.created_at,
        result: p.result,
      })),
    );
    streakByUser.set(uid, { current: streak.current, best: streak.longest });
  }

  type ClerkUser = {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt: number;
  };

  const clerk = await clerkClient();
  const usersResponse = (await clerk.users.getUserList({
    userId: userIds,
    limit: Math.min(500, userIds.length || 1),
  })) as unknown as { data: ClerkUser[] };
  const users: ClerkUser[] = usersResponse.data ?? [];

  const userMeta = new Map<
    string,
    { username: string; memberSince: number }
  >();
  for (const u of users) {
    const username = toUsername({
      username: u.username ?? null,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
    });
    userMeta.set(String(u.id), {
      username: username ?? String(u.id),
      memberSince: typeof u.createdAt === "number" ? u.createdAt : Date.now(),
    });
  }

  const rows = baseRows
    .filter((r) => userMeta.has(r.user_id))
    .slice(0, 200)
    .map((r) => {
      const meta = userMeta.get(r.user_id)!;
      const p = perUserPeriod.get(r.user_id) ?? {
        total: period === "all" ? r.total_picks : 0,
        wins: period === "all" ? r.wins : 0,
        losses: period === "all" ? r.losses : 0,
        profit: 0,
        staked: 0,
      };

      const winRate =
        p.total > 0 ? Math.round(((p.wins / p.total) * 100) * 10) / 10 : 0;
      const roi = p.staked > 0 ? (p.profit / p.staked) * 100 : 0;
      const roiAll = roiAllByUser.get(r.user_id) ?? 0;
      const streak = streakByUser.get(r.user_id) ?? { current: 0, best: 0 };

      const rank = getTipsterRank({
        totalPicks: r.total_picks,
        winRate: r.win_rate,
        roi: roiAll,
      });

      return {
        userId: r.user_id,
        username: meta.username,
        memberSince: meta.memberSince,
        totalPicks: p.total,
        winRate,
        roi: Math.round(clampNumber(roi) * 10) / 10,
        streak: streak.current,
        bestStreak: streak.best,
        rank: rank.key,
        rankLabel: rank.label,
        rankColor: rank.color,
      };
    });

  const sorted = rows.slice().sort((a, b) => {
    if (sort === "total_picks") return b.totalPicks - a.totalPicks;
    if (sort === "roi") return b.roi - a.roi;
    if (sort === "streak") return b.streak - a.streak;
    return b.winRate - a.winRate;
  });

  const featuredId = process.env.FEATURED_TIPSTER_USER_ID || null;
  const featured = featuredId ? sorted.find((r) => r.userId === featuredId) ?? null : null;

  const visible = isPaid ? sorted : sorted.slice(0, 10);

  return NextResponse.json({
    period,
    sort,
    totalTipsters: totalTipsters || sorted.length,
    limited: !isPaid,
    featured,
    rows: visible,
  });
}
