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

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  await supabase
    .from("bankroll_transactions")
    .delete()
    .eq("user_id", userId);

  const { data: bankroll } = await supabase
    .from("virtual_bankrolls")
    .upsert(
      {
        user_id: userId,
        starting_balance: STARTING_BALANCE,
        current_balance: STARTING_BALANCE,
        peak_balance: STARTING_BALANCE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id,current_balance,peak_balance")
    .maybeSingle();

  await supabase.from("bankroll_transactions").insert({
    user_id: userId,
    created_at: new Date().toISOString(),
    type: "reset",
    stake: 0,
    returns: 0,
    profit_loss: 0,
    balance_after: STARTING_BALANCE,
  });

  return NextResponse.json({
    currentBalance: bankroll?.current_balance ?? STARTING_BALANCE,
    peakBalance: bankroll?.peak_balance ?? STARTING_BALANCE,
  });
}

