import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail } from "@/lib/send-email";
import AccumulatorResultEmail from "@/emails/AccumulatorResultEmail";

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

type Selection = { prediction_id: string; tip: string; odds: number };
type AccaRow = {
  id: string;
  user_id: string;
  selections: Selection[];
  combined_odds: number | null;
  stake: number | null;
  potential_return: number | null;
  result: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeCombined(selections: Selection[]) {
  return round2(selections.reduce((acc, s) => acc * Number(s.odds || 1), 1));
}

type Body = { accumulatorId?: string };

export async function POST(request: Request) {
  const secret = process.env.ACCA_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = request.headers.get("x-webhook-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const accumulatorId = body.accumulatorId ? String(body.accumulatorId) : null;

  const supabase = createServiceClient();

  const baseQuery = supabase
    .from("accumulators")
    .select("id,user_id,selections,combined_odds,stake,potential_return,result");

  const { data: accas } = accumulatorId
    ? await baseQuery.eq("id", accumulatorId).limit(1)
    : await baseQuery.eq("result", "pending").limit(200);

  const rows = (accas as AccaRow[] | null) ?? [];
  if (!rows.length) return NextResponse.json({ ok: true, settled: 0 });

  let settled = 0;
  for (const a of rows) {
    const selections = Array.isArray(a.selections) ? a.selections : [];
    if (!selections.length) continue;

    const ids = selections.map((s) => String(s.prediction_id));
    const { data: preds } = await supabase
      .from("predictions")
      .select("id,result,odds")
      .in("id", ids);

    const resultById = new Map<string, string>();
    for (const p of (preds as Array<{ id: string | number; result: string | null }> | null) ?? []) {
      resultById.set(String(p.id), String(p.result ?? "pending").toLowerCase());
    }

    let hasPending = false;
    let hasLoss = false;
    const remaining: Selection[] = [];
    for (const s of selections) {
      const res = resultById.get(String(s.prediction_id)) ?? "pending";
      if (res === "pending") {
        hasPending = true;
        remaining.push(s);
        continue;
      }
      if (res === "loss") {
        hasLoss = true;
        break;
      }
      if (res === "void") {
        continue;
      }
      if (res === "win") {
        remaining.push(s);
        continue;
      }
      hasPending = true;
      remaining.push(s);
    }

    if (hasLoss) {
      const stake = a.stake ?? 0;
      await supabase
        .from("accumulators")
        .update({ result: "loss" })
        .eq("id", a.id);

      const { data: bankroll } = await supabase
        .from("virtual_bankrolls")
        .select("starting_balance,current_balance,peak_balance")
        .eq("user_id", a.user_id)
        .maybeSingle<{
          starting_balance: number | null;
          current_balance: number | null;
          peak_balance: number | null;
        }>();

      const starting = bankroll?.starting_balance ?? 10_000;
      const current = bankroll?.current_balance ?? starting;

      await supabase
        .from("bankroll_transactions")
        .update({
          status: "settled",
          result: "loss",
          returns: 0,
          profit_loss: -stake,
          balance_after: current,
          settled_at: new Date().toISOString(),
        })
        .eq("user_id", a.user_id)
        .eq("prediction_id", `accumulator:${a.id}`)
        .eq("status", "open");

      // Send Accumulator Lost Email
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(a.user_id);
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          await sendEmail({
            to: email,
            subject: "Accumulator Settled - Slip Lost ❌",
            react: React.createElement(AccumulatorResultEmail, {
              username: user.firstName || user.username || "Tipster",
              status: "lost",
              odds: a.combined_odds || 1,
              payout: 0,
              legs: selections.length,
            }),
          });
        }
      } catch (e) {
        console.error("Failed to send acca loss email", e);
      }

      settled += 1;
      continue;
    }

    if (hasPending) continue;

    const finalSelections = remaining;
    if (!finalSelections.length) {
      const stake = a.stake ?? 0;

      const { data: bankroll } = await supabase
        .from("virtual_bankrolls")
        .select("starting_balance,current_balance,peak_balance")
        .eq("user_id", a.user_id)
        .maybeSingle<{
          starting_balance: number | null;
          current_balance: number | null;
          peak_balance: number | null;
        }>();

      const starting = bankroll?.starting_balance ?? 10_000;
      const current = bankroll?.current_balance ?? starting;
      const peak = bankroll?.peak_balance ?? current;

      const nextBalance = current + stake;
      const nextPeak = Math.max(peak, nextBalance);

      await supabase
        .from("accumulators")
        .update({
          selections: [],
          combined_odds: 1,
          potential_return: stake,
          result: "void",
        })
        .eq("id", a.id);

      await supabase
        .from("virtual_bankrolls")
        .upsert(
          {
            user_id: a.user_id,
            starting_balance: starting,
            current_balance: nextBalance,
            peak_balance: nextPeak,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      await supabase
        .from("bankroll_transactions")
        .update({
          status: "settled",
          result: "void",
          returns: stake,
          profit_loss: 0,
          balance_after: nextBalance,
          settled_at: new Date().toISOString(),
        })
        .eq("user_id", a.user_id)
        .eq("prediction_id", `accumulator:${a.id}`)
        .eq("status", "open");

      // Send Accumulator Voided Email
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(a.user_id);
        const email = user.primaryEmailAddress?.emailAddress;
        if (email) {
          await sendEmail({
            to: email,
            subject: "Accumulator Settled - Slip Voided ⚪",
            react: React.createElement(AccumulatorResultEmail, {
              username: user.firstName || user.username || "Tipster",
              status: "void",
              odds: 1,
              payout: stake,
              legs: selections.length,
            }),
          });
        }
      } catch (e) {
        console.error("Failed to send acca void email", e);
      }

      settled += 1;
      continue;
    }

    const newCombined = computeCombined(finalSelections);
    const stake = a.stake ?? 0;
    const credit = stake * newCombined;
    const returnsAmount = round2(credit);
    const profitLoss = round2(returnsAmount - stake);

    const { data: bankroll } = await supabase
      .from("virtual_bankrolls")
      .select("starting_balance,current_balance,peak_balance")
      .eq("user_id", a.user_id)
      .maybeSingle<{
        starting_balance: number | null;
        current_balance: number | null;
        peak_balance: number | null;
      }>();

    const starting = bankroll?.starting_balance ?? 10_000;
    const current = bankroll?.current_balance ?? starting;
    const peak = bankroll?.peak_balance ?? current;

    const nextBalance = current + returnsAmount;
    const nextPeak = Math.max(peak, nextBalance);

    await supabase
      .from("accumulators")
      .update({
        selections: finalSelections,
        combined_odds: newCombined,
        potential_return: returnsAmount,
        result: "win",
      })
      .eq("id", a.id);

    await supabase
      .from("virtual_bankrolls")
      .upsert(
        {
          user_id: a.user_id,
          starting_balance: starting,
          current_balance: nextBalance,
          peak_balance: nextPeak,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    await supabase
      .from("bankroll_transactions")
      .update({
        status: "settled",
        result: "win",
        returns: returnsAmount,
        profit_loss: profitLoss,
        balance_after: nextBalance,
        settled_at: new Date().toISOString(),
      })
      .eq("user_id", a.user_id)
      .eq("prediction_id", `accumulator:${a.id}`)
      .eq("status", "open");

    // Send Accumulator Won Email
    try {
       const clerk = await clerkClient();
       const user = await clerk.users.getUser(a.user_id);
      const email = user.primaryEmailAddress?.emailAddress;
      if (email) {
        await sendEmail({
          to: email,
          subject: "Accumulator Settled - Slip Won! 🎉",
           react: React.createElement(AccumulatorResultEmail, {
             username: user.firstName || user.username || "Tipster",
             status: "won",
             odds: newCombined,
             payout: returnsAmount,
             legs: finalSelections.length,
           }),
        });
      }
    } catch (e) {
      console.error("Failed to send acca win email", e);
    }

    settled += 1;
  }

  return NextResponse.json({ ok: true, settled });
}
