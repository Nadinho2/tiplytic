import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";

import { sendEmail } from "@/lib/send-email";
import WeeklyReportEmail from "@/emails/WeeklyReportEmail";
import { calculateStreak, type CommunityPrediction } from "@/lib/stats-engine";

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

function startOfWeekUtc(d: Date) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}

function addDaysUtc(d: Date, days: number) {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt;
}

function formatMonthDay(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(d);
}

function parseOdds(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type PredictionRow = {
  user_id: string;
  created_at: string | null;
  match_title?: string | null;
  match?: string | null;
  tip?: string | null;
  odds?: number | string | null;
  result?: string | null;
  profit_loss?: number | null;
  stake?: number | null;
  league?: string | null;
};

type TxRow = {
  user_id: string;
  created_at: string | null;
  profit_loss: number | null;
};

function computeRankMap(rows: PredictionRow[]) {
  const perUser = new Map<
    string,
    { wins: number; losses: number; total: number; profit: number; staked: number }
  >();

  for (const r of rows) {
    const res = (r.result ?? "").toLowerCase();
    if (res !== "win" && res !== "loss") continue;
    const cur = perUser.get(r.user_id) ?? { wins: 0, losses: 0, total: 0, profit: 0, staked: 0 };
    cur.total += 1;
    if (res === "win") cur.wins += 1;
    if (res === "loss") cur.losses += 1;
    cur.profit += r.profit_loss ?? 0;
    cur.staked += r.stake ?? 0;
    perUser.set(r.user_id, cur);
  }

  const ranked = Array.from(perUser.entries())
    .map(([userId, s]) => {
      const denom = s.wins + s.losses;
      const winRate = denom > 0 ? (s.wins / denom) * 100 : 0;
      const roi = s.staked > 0 ? (s.profit / s.staked) * 100 : 0;
      return { userId, roi, winRate, total: s.total };
    })
    .sort((a, b) => {
      if (b.roi !== a.roi) return b.roi - a.roi;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    });

  const map = new Map<string, number>();
  for (let i = 0; i < ranked.length; i += 1) map.set(ranked[i]!.userId, i + 1);
  return map;
}

async function tryLog(
  supabase: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
) {
  try {
    await supabase.from("cron_logs").insert(row as never);
  } catch {}
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") || "";
    const headerSecret = request.headers.get("x-cron-secret") || "";
    if (authHeader !== `Bearer ${secret}` && headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const supabase = createServiceClient();
  const now = new Date();
  const thisWeekStart = startOfWeekUtc(now);
  const start = addDaysUtc(thisWeekStart, -7);
  const end = thisWeekStart;
  const prevStart = addDaysUtc(start, -7);
  const prevEnd = start;

  const startLabel = formatMonthDay(start);
  const endLabel = formatMonthDay(addDaysUtc(end, -1));

  let subs: Array<{ clerk_user_id: string; tier: string | null }> = [];
  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("clerk_user_id,tier")
      .neq("tier", "free")
      .limit(50_000);
    subs = (data as typeof subs | null) ?? [];
  } catch {
    subs = [];
  }

  const subscriberIds = Array.from(
    new Set(subs.map((s) => String(s.clerk_user_id)).filter(Boolean)),
  );

  if (!subscriberIds.length) {
    await tryLog(supabase, {
      job: "weekly_report",
      ran_at: new Date().toISOString(),
      status: "no_subscribers",
      meta: { start: start.toISOString(), end: end.toISOString() },
    });
    return NextResponse.json({ ok: true, sent: 0, failed: 0 });
  }

  const { data: weekRowsRaw } = await supabase
    .from("community_predictions")
    .select("user_id,created_at,match_title,match,league,tip,odds,result,profit_loss,stake")
    .in("user_id", subscriberIds)
    .gte("odds", 1.5)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(100_000);

  const weekRows = (weekRowsRaw as PredictionRow[] | null) ?? [];

  const { data: prevRowsRaw } = await supabase
    .from("community_predictions")
    .select("user_id,created_at,league,tip,odds,result,profit_loss,stake")
    .in("user_id", subscriberIds)
    .gte("odds", 1.5)
    .gte("created_at", prevStart.toISOString())
    .lt("created_at", prevEnd.toISOString())
    .order("created_at", { ascending: false })
    .limit(100_000);

  const prevRows = (prevRowsRaw as PredictionRow[] | null) ?? [];

  const weekRank = computeRankMap(weekRows);
  const prevRank = computeRankMap(prevRows);

  const { data: txRowsRaw } = await supabase
    .from("bankroll_transactions")
    .select("user_id,created_at,profit_loss")
    .in("user_id", subscriberIds)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .limit(100_000);
  const txRows = (txRowsRaw as TxRow[] | null) ?? [];
  const bankrollDeltaByUser = new Map<string, number>();
  for (const t of txRows) {
    bankrollDeltaByUser.set(t.user_id, (bankrollDeltaByUser.get(t.user_id) ?? 0) + (t.profit_loss ?? 0));
  }

  type ClerkUser = {
    id: string;
    username: string | null;
    firstName: string | null;
    primaryEmailAddress?: { emailAddress: string } | null;
    emailAddresses?: Array<{ emailAddress: string }> | null;
  };

  const clerk = await clerkClient();
  const users: ClerkUser[] = [];
  for (let i = 0; i < subscriberIds.length; i += 500) {
    const chunk = subscriberIds.slice(i, i + 500);
    try {
      const res = (await clerk.users.getUserList({
        userId: chunk,
        limit: Math.min(500, chunk.length || 1),
      })) as unknown as { data: ClerkUser[] };
      users.push(...(res.data ?? []));
    } catch {}
  }
  const userMeta = new Map<string, { email: string | null; username: string }>();
  for (const u of users) {
    const email =
      u.primaryEmailAddress?.emailAddress ||
      u.emailAddresses?.[0]?.emailAddress ||
      null;
    const username = u.firstName || u.username || "Tipster";
    userMeta.set(String(u.id), { email, username });
  }

  let sent = 0;
  let failed = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const userId of subscriberIds) {
    const meta = userMeta.get(userId);
    const to = meta?.email ?? null;
    const username = meta?.username ?? "Tipster";
    if (!to) continue;

    const myWeek = weekRows.filter((r) => r.user_id === userId);
    const myPrev = prevRows.filter((r) => r.user_id === userId);

    const predictionsMade = myWeek.length;
    const weekDecided = myWeek.filter((r) => (r.result ?? "").toLowerCase() === "win" || (r.result ?? "").toLowerCase() === "loss");
    const prevDecided = myPrev.filter((r) => (r.result ?? "").toLowerCase() === "win" || (r.result ?? "").toLowerCase() === "loss");
    const wins = weekDecided.filter((r) => (r.result ?? "").toLowerCase() === "win").length;
    const losses = weekDecided.filter((r) => (r.result ?? "").toLowerCase() === "loss").length;
    const denom = wins + losses;
    const winRate = denom > 0 ? (wins / denom) * 100 : 0;

    const prevWins = prevDecided.filter((r) => (r.result ?? "").toLowerCase() === "win").length;
    const prevLosses = prevDecided.filter((r) => (r.result ?? "").toLowerCase() === "loss").length;
    const prevDenom = prevWins + prevLosses;
    const prevWinRate = prevDenom > 0 ? (prevWins / prevDenom) * 100 : 0;
    const winRateDelta = winRate - prevWinRate;

    const bankrollChange = bankrollDeltaByUser.get(userId) ?? 0;

    let bestPick: { match: string; tip: string; odds: number } | null = null;
    for (const r of weekDecided) {
      if ((r.result ?? "").toLowerCase() !== "win") continue;
      const odds = parseOdds(r.odds);
      if (!odds) continue;
      if (!bestPick || odds > bestPick.odds) {
        bestPick = {
          match: String(r.match_title ?? r.match ?? "Match"),
          tip: String(r.tip ?? "Tip"),
          odds,
        };
      }
    }

    const leagueMap = new Map<string, { total: number; wins: number; losses: number }>();
    for (const r of weekDecided) {
      const league = r.league ?? "Others";
      const res = (r.result ?? "").toLowerCase();
      if (res !== "win" && res !== "loss") continue;
      const cur = leagueMap.get(league) ?? { total: 0, wins: 0, losses: 0 };
      cur.total += 1;
      if (res === "win") cur.wins += 1;
      if (res === "loss") cur.losses += 1;
      leagueMap.set(league, cur);
    }
    const leagueStats = Array.from(leagueMap.entries())
      .filter(([, s]) => s.total >= 2)
      .map(([league, s]) => ({
        league,
        winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);
    const bestLeague = leagueStats[0]?.league ?? "—";
    const worstLeague = leagueStats.length ? leagueStats[leagueStats.length - 1]!.league : "—";

    let streakLabel = "—";
    try {
      const { data: recentRaw } = await supabase
        .from("community_predictions")
        .select("id,user_id,created_at,match,tip,odds,result,profit_loss,league")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60);
      const recent = (recentRaw as CommunityPrediction[] | null) ?? [];
      const streak = calculateStreak(recent);
      if (streak.current !== 0) {
        streakLabel = streak.current > 0 ? `${streak.current}W` : `${Math.abs(streak.current)}L`;
      }
    } catch {}

    const currentRank = weekRank.get(userId) ?? null;
    const previousRank = prevRank.get(userId) ?? null;
    const rankDelta =
      currentRank && previousRank ? previousRank - currentRank : 0;

    const subject = `Your Week in Review — ${startLabel} to ${endLabel}`;
    const result = await sendEmail({
      to,
      subject,
      react: React.createElement(WeeklyReportEmail, {
        username,
        startLabel,
        endLabel,
        predictionsMade,
        wins,
        losses,
        winRate,
        bankrollChange,
        winRateDelta,
        streakLabel,
        bestPick,
        leagueBreakdown: { best: bestLeague, worst: worstLeague },
        rankDelta,
        fullStatsUrl: `${baseUrl}/dashboard`,
        todaysPredictionsUrl: `${baseUrl}/predictions`,
      }),
    });

    if (result.success) {
      sent += 1;
      await tryLog(supabase, {
        job: "weekly_report",
        ran_at: new Date().toISOString(),
        user_id: userId,
        status: "sent",
        meta: { start: start.toISOString(), end: end.toISOString() },
      });
    } else {
      failed += 1;
      await tryLog(supabase, {
        job: "weekly_report",
        ran_at: new Date().toISOString(),
        user_id: userId,
        status: "failed",
        meta: {
          start: start.toISOString(),
          end: end.toISOString(),
          error: String((result as { error?: unknown }).error ?? "unknown"),
        },
      });
    }
  }

  await tryLog(supabase, {
    job: "weekly_report",
    ran_at: new Date().toISOString(),
    status: "completed",
    meta: { start: start.toISOString(), end: end.toISOString(), sent, failed },
  });

  return NextResponse.json({
    ok: true,
    start: start.toISOString(),
    end: end.toISOString(),
    sent,
    failed,
  });
}
