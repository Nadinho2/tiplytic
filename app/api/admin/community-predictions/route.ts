import "server-only";

import { NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/admin";

function toProfitLoss(result: "win" | "loss" | "void", stake: number, odds: number) {
  if (result === "win") return stake * (odds - 1);
  if (result === "void") return 0;
  return -stake;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = url.searchParams.get("result") || "pending";
  const page = parseInt(url.searchParams.get("page") || "0", 10);
  const pageSize = 50;

  const supabase = createServiceClient();
  try {
    await requireAdmin();

    let query = supabase
      .from("community_predictions")
      .select("id, created_at, user_id, match, match_title, match_date, tip, odds, stake, prediction_type, result, reasoning", { count: "exact" })
      .is("match_id", null)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (result !== "all") {
      query = query.eq("result", result);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    await requireAdmin();
    const body = await request.json();
    const { predictionId, result } = body;

    if (!predictionId || (result !== "win" && result !== "loss" && result !== "void")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data: prediction, error: fetchErr } = await supabase
      .from("community_predictions")
      .select("id, stake, odds, result")
      .eq("id", predictionId)
      .single();

    if (fetchErr || !prediction) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
    }

    if (prediction.result !== "pending") {
      return NextResponse.json({ error: "Prediction already settled" }, { status: 400 });
    }

    const stake = Number(prediction.stake ?? 0);
    const odds = Number(prediction.odds ?? 1);
    const profitLoss = toProfitLoss(result, stake, odds);

    const { error: updateErr } = await supabase
      .from("community_predictions")
      .update({ result, profit_loss: profitLoss })
      .eq("id", predictionId);

    if (updateErr) throw updateErr;

    // Settle Bankroll
    let settled = false;
    const settleSecret = process.env.BANKROLL_WEBHOOK_SECRET;
    if (settleSecret && stake > 0) {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/bankroll/settle`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": settleSecret,
        },
        body: JSON.stringify({
          predictionId: `community:${String(predictionId)}`,
          result,
        }),
      }).catch(() => null);

      if (resp && resp.ok) settled = true;
    }

    return NextResponse.json({ ok: true, settled });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Internal Server Error" }, { status });
  }
}
