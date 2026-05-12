import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";
import { calculateStreak, type CommunityPrediction } from "@/lib/stats-engine";

type Body = { result?: string };

function normalizeResult(v: string) {
  const s = v.trim().toLowerCase();
  if (s === "win" || s === "loss" || s === "void") return s;
  return null;
}

function toProfitLoss(result: "win" | "loss" | "void", stake: number, odds: number) {
  if (result === "win") return stake * (odds - 1);
  if (result === "void") return 0;
  return -stake;
}

async function recalcAdminPickStats(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from("predictions")
    .select("created_at,result")
    .eq("is_admin_pick", true)
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = (data as Array<{ created_at: string | null; result: string | null }> | null) ?? [];
  const decided = rows.filter((r) => r.result === "win" || r.result === "loss");
  const wins = decided.filter((r) => r.result === "win").length;
  const losses = decided.filter((r) => r.result === "loss").length;
  const total = wins + losses;

  const streak = calculateStreak(
    rows.map((r, idx) => ({
      id: idx,
      user_id: "admin",
      created_at: r.created_at,
      result: r.result,
    })) as unknown as CommunityPrediction[],
  );

  await supabase.from("admin_pick_stats").insert({
    total_picks: total,
    total_wins: wins,
    total_losses: losses,
    current_streak: streak.current,
    best_streak: streak.longest,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Body;
    const result = normalizeResult(String(body.result ?? ""));
    if (!result) return NextResponse.json({ error: "Invalid result" }, { status: 400 });

    const { data: prediction } = await supabase
      .from("predictions")
      .select("id,is_admin_pick")
      .eq("id", id)
      .maybeSingle<{ id: string | number; is_admin_pick: boolean | null }>();

    if (!prediction) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error: updateErr } = await supabase
      .from("predictions")
      .update({ result, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    let updatedCommunity = 0;
    let settled = 0;

    const { data: cps } = await supabase
      .from("community_predictions")
      .select("id,stake,odds")
      .eq("match_id", String(id))
      .limit(5000);

    const communityRows =
      (cps as Array<{ id: string | number; stake: number | null; odds: number | null }> | null) ?? [];

    if (communityRows.length) {
      const updates = communityRows.map((r) => {
        const stake = Number(r.stake ?? 0);
        const odds = Number(r.odds ?? 1);
        const profitLoss = toProfitLoss(result, stake, odds);
        return {
          id: r.id,
          result,
          profit_loss: profitLoss,
        };
      });

      const { error } = await supabase.from("community_predictions").upsert(updates as never, {
        onConflict: "id",
      });
      if (!error) updatedCommunity = updates.length;
    }

    const settleSecret = process.env.BANKROLL_WEBHOOK_SECRET;
    if (settleSecret) {
      for (const r of communityRows) {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/bankroll/settle`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-secret": settleSecret,
          },
          body: JSON.stringify({
            predictionId: `community:${String(r.id)}`,
            result,
          }),
        }).catch(() => null);

        if (resp && resp.ok) settled += 1;
      }
    }

    if (prediction.is_admin_pick) {
      try {
        await recalcAdminPickStats(supabase);
      } catch {}
    }

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "prediction.update_result",
      target_type: "prediction",
      target_id: String(id),
      details: { result, updatedCommunity, settled },
    });

    return NextResponse.json({
      ok: true,
      id,
      result,
      updatedCommunity,
      settled,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

