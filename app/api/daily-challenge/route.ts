import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

const OPTIONS = ["Home Win", "Draw", "Away Win"] as const;
type Option = (typeof OPTIONS)[number];

function isOption(value: string): value is Option {
  return (OPTIONS as readonly string[]).includes(value);
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lockTimeMs(kickoffIso: string) {
  const kickoff = new Date(kickoffIso);
  if (Number.isNaN(kickoff.getTime())) return null;
  return kickoff.getTime() - 30 * 60 * 1000;
}

export async function GET() {
  const { userId } = await auth();
  const supabase = createServiceClient();

  const today = toIsoDate(new Date());

  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("id,match_id,challenge_date,correct_tip,participants,correct_count")
    .eq("challenge_date", today)
    .maybeSingle<{
      id: string;
      match_id: string | number | null;
      challenge_date: string;
      correct_tip: string | null;
      participants: number | null;
      correct_count: number | null;
    }>();

  if (!challenge?.id || !challenge.match_id) {
    return NextResponse.json({
      challenge: null,
      options: OPTIONS,
    });
  }

  const { data: match } = await supabase
    .from("predictions")
    .select("id,home_team,away_team,league,match_date,odds")
    .eq("id", String(challenge.match_id))
    .maybeSingle<{
      id: string | number;
      home_team: string | null;
      away_team: string | null;
      league: string | null;
      match_date: string | null;
      odds: number | string | null;
    }>();

  if (!match?.match_date) {
    return NextResponse.json({
      challenge: null,
      options: OPTIONS,
    });
  }

  const now = Date.now();
  const lockAt = lockTimeMs(match.match_date);
  const kickoffMs = new Date(match.match_date).getTime();

  const status =
    challenge.correct_tip != null
      ? "resolved"
      : lockAt != null && now >= lockAt
        ? "locked"
        : "open";

  const { count: participants } = await supabase
    .from("challenge_entries")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challenge.id);

  const entry =
    userId
      ? (
          await supabase
            .from("challenge_entries")
            .select("tip,is_correct,points_earned,created_at")
            .eq("challenge_id", challenge.id)
            .eq("user_id", userId)
            .maybeSingle<{
              tip: string;
              is_correct: boolean | null;
              points_earned: number | null;
              created_at: string | null;
            }>()
        ).data ?? null
      : null;

  let split: Array<{ tip: Option; count: number; pct: number }> = [];
  if (status !== "open") {
    const { data } = await supabase
      .from("challenge_entries")
      .select("tip")
      .eq("challenge_id", challenge.id)
      .limit(5000);
    const tips = ((data as Array<{ tip: string | null }> | null) ?? [])
      .map((r) => (r.tip ?? "").trim())
      .filter(isOption);
    const counts = new Map<Option, number>();
    for (const o of OPTIONS) counts.set(o, 0);
    for (const t of tips) counts.set(t, (counts.get(t) ?? 0) + 1);
    const total = tips.length;
    split = OPTIONS.map((o) => {
      const c = counts.get(o) ?? 0;
      return { tip: o, count: c, pct: total > 0 ? (c / total) * 100 : 0 };
    });
  }

  const { count: correctCount } =
    status === "resolved"
      ? await supabase
          .from("challenge_entries")
          .select("*", { count: "exact", head: true })
          .eq("challenge_id", challenge.id)
          .eq("is_correct", true)
      : { count: null };

  return NextResponse.json({
    challenge: {
      id: challenge.id,
      matchId: String(challenge.match_id),
      challengeDate: challenge.challenge_date,
      correctTip: challenge.correct_tip,
      participants: participants ?? challenge.participants ?? 0,
      correctCount: correctCount ?? challenge.correct_count ?? 0,
    },
    match: {
      id: String(match.id),
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      league: match.league,
      kickoffAt: match.match_date,
      kickoffMs,
      odds: match.odds,
    },
    status,
    lockAtMs: lockAt,
    options: OPTIONS,
    entry,
    split: split.map((s) => ({
      tip: s.tip,
      count: s.count,
      pct: Math.round(s.pct * 10) / 10,
    })),
  });
}

type PostBody = { tip: string };

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const tip = String(body.tip || "").trim();
  if (!isOption(tip)) return NextResponse.json({ error: "Invalid tip" }, { status: 400 });

  const supabase = createServiceClient();
  const today = toIsoDate(new Date());

  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("id,match_id,correct_tip")
    .eq("challenge_date", today)
    .maybeSingle<{ id: string; match_id: string | number | null; correct_tip: string | null }>();

  if (!challenge?.id || !challenge.match_id) {
    return NextResponse.json({ error: "No active challenge" }, { status: 404 });
  }
  if (challenge.correct_tip) {
    return NextResponse.json({ error: "Challenge already resolved" }, { status: 400 });
  }

  const { data: match } = await supabase
    .from("predictions")
    .select("match_date")
    .eq("id", String(challenge.match_id))
    .maybeSingle<{ match_date: string | null }>();

  if (!match?.match_date) {
    return NextResponse.json({ error: "Challenge match not found" }, { status: 404 });
  }

  const lockAt = lockTimeMs(match.match_date);
  if (lockAt != null && Date.now() >= lockAt) {
    return NextResponse.json({ error: "Challenge is locked" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("challenge_entries")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    return NextResponse.json({ error: "You already entered today" }, { status: 409 });
  }

  const { data: inserted, error } = await supabase
    .from("challenge_entries")
    .insert({
      user_id: userId,
      challenge_id: challenge.id,
      tip,
      is_correct: null,
      points_earned: 0,
      created_at: new Date().toISOString(),
    })
    .select("id,tip,created_at")
    .maybeSingle<{ id: string; tip: string; created_at: string }>();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Failed to submit entry" }, { status: 400 });
  }

  return NextResponse.json({ entry: inserted });
}
