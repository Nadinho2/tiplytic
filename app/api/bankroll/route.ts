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

type VirtualBankrollRow = {
  user_id: string;
  starting_balance: number | null;
  current_balance: number | null;
  peak_balance: number | null;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: bankroll } = await supabase
    .from("virtual_bankrolls")
    .select("user_id,starting_balance,current_balance,peak_balance")
    .eq("user_id", userId)
    .maybeSingle<VirtualBankrollRow>();

  const starting = bankroll?.starting_balance ?? STARTING_BALANCE;
  const current = bankroll?.current_balance ?? starting;
  const peak = bankroll?.peak_balance ?? current;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  const { data: txs } = await supabase
    .from("bankroll_transactions")
    .select("created_at,balance_after")
    .eq("user_id", userId)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(3000);

  const sparkline =
    (txs as Array<{ created_at: string; balance_after: number | null }> | null)?.map(
      (t) => ({
        date: t.created_at.slice(0, 10),
        balance: t.balance_after ?? current,
      }),
    ) ?? [];

  return NextResponse.json({
    startingBalance: starting,
    currentBalance: current,
    peakBalance: peak,
    sparkline,
  });
}

