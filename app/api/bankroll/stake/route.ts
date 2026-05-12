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

type StakeBody = {
  predictionId: string | number;
  match?: string;
  tip?: string;
  odds: number;
  stake: number;
};

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

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as StakeBody;
  const odds = Number(body.odds);
  const stake = Math.floor(Number(body.stake));

  if (!body.predictionId) {
    return NextResponse.json({ error: "Missing predictionId" }, { status: 400 });
  }
  if (!Number.isFinite(odds) || odds <= 1) {
    return NextResponse.json({ error: "Invalid odds" }, { status: 400 });
  }
  if (!Number.isFinite(stake) || stake < 100) {
    return NextResponse.json({ error: "Stake must be at least ₦100" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const bankroll = await ensureBankroll(supabase, userId);

  const maxStake = Math.floor(bankroll.current * 0.2);
  if (stake > maxStake) {
    return NextResponse.json(
      { error: `Max stake is ₦${maxStake.toLocaleString()}` },
      { status: 400 },
    );
  }
  if (stake > bankroll.current) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("bankroll_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("prediction_id", String(body.predictionId))
    .eq("type", "stake")
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    return NextResponse.json({ error: "Already staked on this prediction" }, { status: 409 });
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
    prediction_id: String(body.predictionId),
    match: body.match ?? null,
    tip: body.tip ?? null,
    odds,
    stake,
    returns: 0,
    profit_loss: -stake,
    balance_after: nextBalance,
    status: "open",
  });

  return NextResponse.json({
    currentBalance: nextBalance,
    peakBalance: nextPeak,
  });
}
