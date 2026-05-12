import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { checkAndAwardBadges } from "@/lib/badge-checker";

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

type SettleBody = {
  predictionId: string | number;
  result: "win" | "loss" | "void";
};

const STARTING_BALANCE = 10_000;

export async function POST(request: Request) {
  const secret = process.env.BANKROLL_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = request.headers.get("x-webhook-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await request.json()) as SettleBody;
  const result = body.result;
  const predictionId = body.predictionId;

  if (!predictionId || (result !== "win" && result !== "loss" && result !== "void")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: tx } = await supabase
    .from("bankroll_transactions")
    .select("*")
    .eq("prediction_id", String(predictionId))
    .eq("type", "stake")
    .eq("status", "open")
    .maybeSingle<{
      id: string;
      user_id: string;
      stake: number | null;
      odds: number | null;
    }>();

  if (!tx) {
    return NextResponse.json({ ok: true, message: "No open stake found" });
  }

  const userId = tx.user_id;
  const stake = tx.stake ?? 0;
  const odds = tx.odds ?? 1;

  const { data: bankroll } = await supabase
    .from("virtual_bankrolls")
    .select("starting_balance,current_balance,peak_balance")
    .eq("user_id", userId)
    .maybeSingle<{
      starting_balance: number | null;
      current_balance: number | null;
      peak_balance: number | null;
    }>();

  const starting = bankroll?.starting_balance ?? STARTING_BALANCE;
  const current = bankroll?.current_balance ?? starting;
  const peak = bankroll?.peak_balance ?? current;

  let credit = 0;
  if (result === "win") credit = stake * odds;
  if (result === "void") credit = stake;

  const nextBalance = current + credit;
  const nextPeak = Math.max(peak, nextBalance);

  await supabase
    .from("virtual_bankrolls")
    .upsert(
      {
        user_id: userId,
        starting_balance: starting,
        current_balance: nextBalance,
        peak_balance: nextPeak,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  const returnsAmount = credit;
  const profitLoss = result === "win" ? stake * (odds - 1) : result === "void" ? 0 : -stake;

  await supabase
    .from("bankroll_transactions")
    .update({
      status: "settled",
      result,
      returns: returnsAmount,
      profit_loss: profitLoss,
      balance_after: nextBalance,
      settled_at: new Date().toISOString(),
    })
    .eq("id", tx.id);

  try {
    await checkAndAwardBadges(userId);
  } catch {}

  return NextResponse.json({
    ok: true,
    userId,
    result,
    nextBalance,
    nextPeak,
  });
}
