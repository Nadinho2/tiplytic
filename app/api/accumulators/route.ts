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

const STARTING_BALANCE = 10_000;

async function ensureBankroll(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
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

type Selection = {
  prediction_id: string | number;
  tip: string;
  odds: number;
};

function clampOdds(n: number) {
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return null;
  return n;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("accumulators")
    .select("id,user_id,selections,combined_odds,stake,potential_return,result,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

type PostBody = {
  selections: Selection[];
  stake: number;
  mode?: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as PostBody;
  const selections = Array.isArray(body.selections) ? body.selections : [];
  const stake = Math.floor(Number(body.stake));
  const mode = String(body.mode ?? "").toLowerCase();
  const isDraft = mode === "draft" || !Number.isFinite(stake) || stake <= 0;

  if (!selections.length) {
    return NextResponse.json({ error: "Add at least one selection" }, { status: 400 });
  }
  if (selections.length > 10) {
    return NextResponse.json({ error: "Max 10 selections per accumulator" }, { status: 400 });
  }

  const dedup = new Map<string, Selection>();
  for (const s of selections) {
    const id = String(s.prediction_id);
    const tip = String(s.tip || "").trim();
    const o = clampOdds(Number(s.odds));
    if (!id || !tip || o == null) continue;
    dedup.set(id, { prediction_id: id, tip, odds: o });
  }

  const normalized = Array.from(dedup.values());
  if (!normalized.length) {
    return NextResponse.json({ error: "Invalid selections" }, { status: 400 });
  }

  const combined = round2(normalized.reduce((acc, s) => acc * s.odds, 1));
  const potentialReturn = isDraft ? null : round2(stake * combined);

  const supabase = createServiceClient();
  const bankroll = isDraft ? null : await ensureBankroll(supabase, userId);

  if (!isDraft) {
    if (stake < 100) {
      return NextResponse.json({ error: "Stake must be at least ₦100" }, { status: 400 });
    }
    const maxStake = Math.floor((bankroll as { current: number }).current * 0.2);
    if (stake > maxStake) {
      return NextResponse.json(
        { error: `Max stake is ₦${maxStake.toLocaleString()}` },
        { status: 400 },
      );
    }
    if (stake > (bankroll as { current: number }).current) {
      return NextResponse.json({ error: "Insufficient bankroll balance" }, { status: 400 });
    }
  }

  const nextBalance = !isDraft ? (bankroll as { current: number }).current - stake : null;
  const nextPeak = !isDraft ? Math.max((bankroll as { peak: number }).peak, nextBalance as number) : null;

  const { data: inserted, error } = await supabase
    .from("accumulators")
    .insert({
      user_id: userId,
      selections: normalized,
      combined_odds: combined,
      stake: isDraft ? null : stake,
      potential_return: potentialReturn,
      result: isDraft ? "draft" : "pending",
      created_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Failed to create accumulator" }, { status: 400 });
  }

  if (!isDraft) {
    await supabase
      .from("virtual_bankrolls")
      .upsert(
        {
          user_id: userId,
          starting_balance: (bankroll as { starting: number }).starting,
          current_balance: nextBalance,
          peak_balance: nextPeak,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    await supabase.from("bankroll_transactions").insert({
      user_id: userId,
      created_at: new Date().toISOString(),
      type: "accumulator",
      prediction_id: `accumulator:${String((inserted as { id: string }).id)}`,
      match: `Accumulator (${normalized.length} selections)`,
      tip: "ACCUMULATOR",
      odds: combined,
      stake,
      returns: 0,
      profit_loss: -stake,
      balance_after: nextBalance,
      status: "open",
    });
  }

  return NextResponse.json({
    accumulator: inserted,
    nextBalance: typeof nextBalance === "number" ? nextBalance : undefined,
  });
}
