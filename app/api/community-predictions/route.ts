import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { checkAndAwardBadges } from "@/lib/badge-checker";
import { sendEmail } from "@/lib/send-email";
import BankrollWarningEmail from "@/emails/BankrollWarningEmail";

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

function startOfUtcDayIso(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
}

function endOfUtcDayIso(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59),
  ).toISOString();
}

function makeMatchTitle(home?: string | null, away?: string | null) {
  return `${home ?? "Home"} vs ${away ?? "Away"}`;
}

async function ensureBankroll(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const STARTING_BALANCE = 10_000;
  const { data } = await supabase
    .from("virtual_bankrolls")
    .select("user_id,starting_balance,current_balance,peak_balance")
    .eq("user_id", userId)
    .maybeSingle<{
      user_id: string;
      starting_balance: number | null;
      current_balance: number | null;
      peak_balance: number | null;
    }>();

  if (data) {
    const starting = data.starting_balance ?? STARTING_BALANCE;
    const current = data.current_balance ?? starting;
    const peak = data.peak_balance ?? current;
    return { starting, current, peak };
  }

  await supabase.from("virtual_bankrolls").insert({
    user_id: userId,
    starting_balance: STARTING_BALANCE,
    current_balance: STARTING_BALANCE,
    peak_balance: STARTING_BALANCE,
    updated_at: new Date().toISOString(),
  });

  return { starting: STARTING_BALANCE, current: STARTING_BALANCE, peak: STARTING_BALANCE };
}

async function lockPredictionsForMatch(
  supabase: ReturnType<typeof createServiceClient>,
  matchId: string,
) {
  try {
    await supabase
      .from("community_predictions")
      .update({ locked_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .is("locked_at", null);
  } catch {}
}

type PostBody = {
  matchId: string;
  predictionType: "1X2" | "Over/Under" | "BTTS" | "Handicap";
  tip: string;
  odds: number;
  stake?: number | null;
  reasoning?: string | null;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as PostBody;
  const matchId = String(body.matchId || "").trim();
  const tip = String(body.tip || "").trim();
  const predictionType = String(body.predictionType || "").trim();
  const odds = Number(body.odds);
  const stake = body.stake == null ? null : Math.floor(Number(body.stake));
  const reasoning = body.reasoning ? String(body.reasoning).slice(0, 200) : null;

  if (!matchId) return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  if (!tip) return NextResponse.json({ error: "Missing tip" }, { status: 400 });
  if (
    predictionType !== "1X2" &&
    predictionType !== "Over/Under" &&
    predictionType !== "BTTS" &&
    predictionType !== "Handicap"
  ) {
    return NextResponse.json({ error: "Invalid predictionType" }, { status: 400 });
  }
  if (!Number.isFinite(odds) || odds < 1.5) {
    return NextResponse.json(
      { error: "Only predictions at odds 1.50+ count toward your rank" },
      { status: 400 },
    );
  }
  if (reasoning && reasoning.length > 200) {
    return NextResponse.json({ error: "Reasoning must be 200 characters or less" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: fixture, error: fixtureError } = await supabase
    .from("predictions")
    .select("id,league,home_team,away_team,match_date")
    .eq("id", matchId)
    .maybeSingle<{
      id: string | number;
      league: string | null;
      home_team: string | null;
      away_team: string | null;
      match_date: string | null;
    }>();

  if (fixtureError || !fixture) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const matchDate = fixture.match_date;
  if (!matchDate) {
    return NextResponse.json({ error: "Match kickoff time missing" }, { status: 400 });
  }

  const kickoff = new Date(matchDate);
  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    return NextResponse.json({ error: "Match kickoff time missing" }, { status: 400 });
  }

  const now = new Date();
  const todayStart = startOfUtcDayIso(now);
  const todayEnd = endOfUtcDayIso(now);
  if (!(matchDate >= todayStart && matchDate <= todayEnd)) {
    return NextResponse.json({ error: "Match must be in today’s fixtures" }, { status: 400 });
  }

  const deltaMs = kickoff.getTime() - now.getTime();
  if (deltaMs <= 0) {
    return NextResponse.json({ error: "Match has already kicked off" }, { status: 400 });
  }
  if (deltaMs <= 30 * 60 * 1000) {
    await lockPredictionsForMatch(supabase, matchId);
    return NextResponse.json({ error: "Predictions are locked for this match" }, { status: 400 });
  }

  const { count: todayCount } = await supabase
    .from("community_predictions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  if ((todayCount ?? 0) >= 10) {
    return NextResponse.json({ error: "Daily limit reached (10 predictions)" }, { status: 429 });
  }

  const matchTitle = makeMatchTitle(fixture.home_team, fixture.away_team);
  const league = fixture.league ?? null;

  try {
    const { data: existingByMatchId } = await supabase
      .from("community_predictions")
      .select("id,locked_at")
      .eq("user_id", userId)
      .eq("match_id", matchId)
      .maybeSingle<{ id: string | number; locked_at: string | null }>();

    if (existingByMatchId?.id) {
      return NextResponse.json({ error: "You already predicted this match" }, { status: 409 });
    }
  } catch {
    const { data: existingByMatch } = await supabase
      .from("community_predictions")
      .select("id")
      .eq("user_id", userId)
      .eq("match", matchTitle)
      .maybeSingle<{ id: string | number }>();
    if (existingByMatch?.id) {
      return NextResponse.json({ error: "You already predicted this match" }, { status: 409 });
    }
  }

  type InsertedRow = { id: string | number } & Record<string, unknown>;
  let inserted: InsertedRow | null = null;

  try {
    const { data, error } = await supabase
      .from("community_predictions")
      .insert({
        user_id: userId,
        created_at: new Date().toISOString(),
        match_id: matchId,
        match_title: matchTitle,
        match_date: matchDate,
        league,
        prediction_type: predictionType,
        tip,
        odds,
        stake: stake ?? null,
        reasoning,
        result: "pending",
        locked_at: null,
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    inserted = (data as InsertedRow | null) ?? null;
  } catch {
    const { data, error } = await supabase
      .from("community_predictions")
      .insert({
        user_id: userId,
        created_at: new Date().toISOString(),
        match: matchTitle,
        league,
        tip,
        odds,
        result: "pending",
      })
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    inserted = (data as InsertedRow | null) ?? null;
  }

  if (!inserted?.id) {
    return NextResponse.json({ error: "Failed to create prediction" }, { status: 500 });
  }

  if (stake != null) {
    if (!Number.isFinite(stake) || stake < 100) {
      return NextResponse.json({ error: "Stake must be at least ₦100" }, { status: 400 });
    }

    const bankroll = await ensureBankroll(supabase, userId);
    const maxStake = Math.floor(bankroll.current * 0.2);
    if (stake > maxStake) {
      return NextResponse.json(
        { error: `Max stake is ₦${maxStake.toLocaleString()}` },
        { status: 400 },
      );
    }
    if (stake > bankroll.current) {
      return NextResponse.json({ error: "Insufficient bankroll balance" }, { status: 400 });
    }

    const nextBalance = bankroll.current - stake;
    const nextPeak = Math.max(bankroll.peak, nextBalance);

    await supabase
      .from("virtual_bankrolls")
      .upsert(
        {
          user_id: userId,
          starting_balance: bankroll.starting,
          current_balance: nextBalance,
          peak_balance: nextPeak,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    await supabase.from("bankroll_transactions").insert({
      user_id: userId,
      created_at: new Date().toISOString(),
      type: "stake",
      prediction_id: `community:${String(inserted.id)}`,
      match: matchTitle,
      tip,
      odds,
      stake,
      returns: 0,
      profit_loss: -stake,
      balance_after: nextBalance,
      status: "open",
    });

    if (nextBalance < 1000 && bankroll.current >= 1000) {
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          await sendEmail({
            to: email,
            subject: "Low Bankroll Alert ⚠️",
            react: React.createElement(BankrollWarningEmail, {
              username: user.firstName || user.username || "Tipster",
              currentBalance: nextBalance,
            }),
          });
        }
      } catch (e) {
        console.error("Failed to send bankroll warning email", e);
      }
    }
  }

  try {
    await checkAndAwardBadges(userId);
  } catch {}

  return NextResponse.json({ prediction: inserted });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId");
  const today = url.searchParams.get("today") === "1";
  const mine = url.searchParams.get("mine") === "1";

  const supabase = createServiceClient();

  if (today) {
    const now = new Date();
    const start = startOfUtcDayIso(now);
    const end = endOfUtcDayIso(now);
    const { data, error } = await supabase
      .from("predictions")
      .select("id,league,home_team,away_team,match_date")
      .gte("match_date", start)
      .lte("match_date", end)
      .order("match_date", { ascending: true })
      .limit(300);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ fixtures: data ?? [] });
  }

  if (mine) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const start = startOfUtcDayIso(now);

    try {
      const { data, error } = await supabase
        .from("community_predictions")
        .select("id,created_at,match_title,match,tip,odds,result,profit_loss,reasoning,stake")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [], since: start });
    } catch {
      const { data } = await supabase
        .from("community_predictions")
        .select("id,created_at,match,tip,odds,result,profit_loss")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      return NextResponse.json({ rows: data ?? [], since: start });
    }
  }

  if (!matchId) {
    return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  }

  try {
    const { data: fx } = await supabase
      .from("predictions")
      .select("match_date")
      .eq("id", matchId)
      .maybeSingle<{ match_date: string | null }>();
    const kickoff = fx?.match_date ? new Date(fx.match_date) : null;
    if (kickoff && !Number.isNaN(kickoff.getTime())) {
      const deltaMs = kickoff.getTime() - Date.now();
      if (deltaMs <= 30 * 60 * 1000) {
        await lockPredictionsForMatch(supabase, matchId);
      }
    }
  } catch {}

  const { data } = await supabase
    .from("community_predictions")
    .select("tip")
    .eq("match_id", matchId)
    .limit(5000);

  const tips = ((data as Array<{ tip: string | null }> | null) ?? [])
    .map((r) => (r.tip ?? "").trim())
    .filter(Boolean);

  const total = tips.length;
  const counts = new Map<string, number>();
  for (const t of tips) {
    const key = t.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const breakdown = Array.from(counts.entries())
    .map(([key, count]) => ({ key, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  const top = breakdown[0] ?? null;
  const favourite = Boolean(top && total >= 5 && top.pct >= 70);

  return NextResponse.json({
    totalPredictors: total,
    breakdown: breakdown.map((b) => ({ tip: b.key, pct: Math.round(b.pct * 10) / 10 })),
    topTip: top?.key ?? null,
    topPct: top ? Math.round(top.pct * 10) / 10 : 0,
    favourite,
  });
}
