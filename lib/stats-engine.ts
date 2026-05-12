import "server-only";

import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";

import { TIER_HIERARCHY, type Tier } from "@/lib/tier-access";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizeTier(value: string | null | undefined): Tier {
  const v = (value ?? "").toLowerCase();
  if (v === "elite") return "elite";
  if (v === "pro") return "pro";
  if (v === "basic") return "basic";
  return "free";
}

function createServiceClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type CommunityPrediction = {
  id: string | number;
  user_id: string;
  created_at?: string | null;
  match?: string | null;
  tip?: string | null;
  odds?: number | string | null;
  result?: "win" | "loss" | "pending" | "void" | string | null;
  profit_loss?: number | null;
  league?: string | null;
};

export type BankrollTransaction = {
  id: string | number;
  user_id: string;
  created_at?: string | null;
  staked?: number | null;
  returns?: number | null;
  balance?: number | null;
};

export type StreakStats = {
  current: number;
  type: "win" | "loss" | "none";
  longest: number;
};

export function calculateStreak(predictions: CommunityPrediction[]): StreakStats {
  const sorted = predictions
    .slice()
    .sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });

  const decided = sorted.filter((p) => p.result === "win" || p.result === "loss");
  if (!decided.length) return { current: 0, type: "none", longest: 0 };

  const target = decided[0]?.result === "loss" ? "loss" : "win";

  let currentCount = 0;
  for (const p of decided) {
    if (p.result !== target) break;
    currentCount += 1;
  }

  let longest = 0;
  let run = 0;
  for (const p of decided.slice().reverse()) {
    if (p.result === "win") {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  return {
    current: target === "loss" ? -currentCount : currentCount,
    type: target,
    longest,
  };
}

export function calculateROI(transactions: BankrollTransaction[]): number {
  let totalStaked = 0;
  let totalReturns = 0;
  for (const t of transactions) {
    totalStaked += t.staked ?? 0;
    totalReturns += t.returns ?? 0;
  }
  if (totalStaked <= 0) return 0;
  return ((totalReturns - totalStaked) / totalStaked) * 100;
}

export async function getLeagueBreakdown(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("community_predictions")
    .select("league,result")
    .eq("user_id", userId)
    .limit(5000);

  const map = new Map<
    string,
    { league: string; total: number; wins: number; losses: number; winRate: number }
  >();

  for (const row of (data as Array<{ league: string | null; result: string | null }> | null) ?? []) {
    const league = row.league ?? "Others";
    const existing = map.get(league) ?? {
      league,
      total: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    };
    if (row.result === "win") existing.wins += 1;
    if (row.result === "loss") existing.losses += 1;
    if (row.result === "win" || row.result === "loss") existing.total += 1;
    existing.winRate = existing.total > 0 ? (existing.wins / existing.total) * 100 : 0;
    map.set(league, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.winRate - a.winRate);
}

export async function getBestWorstLeague(userId: string): Promise<{
  best: string;
  worst: string;
}> {
  const breakdown = await getLeagueBreakdown(userId);
  if (!breakdown.length) return { best: "—", worst: "—" };
  const best = breakdown[0]?.league ?? "—";
  const worst = breakdown[breakdown.length - 1]?.league ?? "—";
  return { best, worst };
}

export async function getUserStats(userId: string): Promise<{
  totalPredictions: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: StreakStats;
  roi: number;
  bankrollBalance: number;
  tier: Tier;
  nextTier: Tier | null;
  progressToNext: number;
  recent: CommunityPrediction[];
  history: CommunityPrediction[];
  bankrollSeries: Array<{ date: string; balance: number }>;
  leagueBreakdown: Array<{
    league: string;
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  }>;
}> {
  const supabase = createServiceClient();

  let tier: Tier = "free";
  const { data: tierRow, error: tierError } = await supabase
    .from("user_subscriptions")
    .select("tier")
    .eq("clerk_user_id", userId)
    .maybeSingle<{ tier: string }>();
  if (!tierError && tierRow?.tier) tier = normalizeTier(tierRow.tier);

  if (tier === "free") {
    try {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
      const sub = meta.subscription as Record<string, unknown> | null;
      if (sub) tier = normalizeTier(sub.tier as string);
    } catch {}
  }

  const { data: preds } = await supabase
    .from("community_predictions")
    .select("id,user_id,created_at,match,tip,odds,result,profit_loss,league")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const history = (preds as CommunityPrediction[] | null) ?? [];
  const recent = history.slice(0, 10);

  const wins = history.filter((p) => p.result === "win").length;
  const losses = history.filter((p) => p.result === "loss").length;
  const totalPredictions = wins + losses;
  const winRate = totalPredictions > 0 ? (wins / totalPredictions) * 100 : 0;
  const streak = calculateStreak(history);

  const { data: txs } = await supabase
    .from("bankroll_transactions")
    .select("id,user_id,created_at,staked,returns,balance")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(5000);

  const transactions = (txs as BankrollTransaction[] | null) ?? [];
  const roi = calculateROI(transactions);
  const bankrollBalance =
    transactions.length > 0 ? transactions[transactions.length - 1]?.balance ?? 0 : 0;

  const bankrollSeries = transactions
    .filter((t) => typeof t.balance === "number" && Boolean(t.created_at))
    .map((t) => ({
      date: (t.created_at as string).slice(0, 10),
      balance: t.balance as number,
    }));

  const leagueBreakdown = await getLeagueBreakdown(userId);

  const orderedTiers: Tier[] = ["free", "basic", "pro", "elite"];
  const idx = orderedTiers.indexOf(tier);
  const nextTier = idx >= 0 && idx < orderedTiers.length - 1 ? orderedTiers[idx + 1] : null;

  const progressToNext = (() => {
    if (!nextTier) return 100;
    const goal = nextTier === "basic" ? 10 : nextTier === "pro" ? 50 : 200;
    return Math.max(0, Math.min(100, (totalPredictions / goal) * 100));
  })();

  return {
    totalPredictions,
    wins,
    losses,
    winRate,
    streak,
    roi,
    bankrollBalance,
    tier,
    nextTier,
    progressToNext,
    recent,
    history,
    bankrollSeries,
    leagueBreakdown,
  };
}

export function getTierLabel(tier: Tier) {
  return tier[0]?.toUpperCase() + tier.slice(1);
}

export function getTierProgressLabel(tier: Tier, nextTier: Tier | null, progress: number) {
  if (!nextTier) return `${getTierLabel(tier)} • Max tier`;
  return `${getTierLabel(tier)} → ${getTierLabel(nextTier)} • ${Math.round(progress)}%`;
}

export function getTierRankNumber(tier: Tier) {
  return TIER_HIERARCHY[tier] + 1;
}
