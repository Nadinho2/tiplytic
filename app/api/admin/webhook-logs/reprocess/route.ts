import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

type Body = { id?: string };

function normalizeResult(v: string) {
  const s = v.trim().toLowerCase();
  if (s === "win" || s === "loss" || s === "void") return s;
  return null;
}

async function processPrediction(
  supabase: ReturnType<typeof createServiceClient>,
  payload: unknown,
) {
  const body = (payload ?? {}) as Record<string, unknown>;
  const matchDate = String(body.match_date ?? body.matchDate ?? "").trim();
  const tip = String(body.tip ?? "").trim();
  const odds = Number(body.odds);
  if (!matchDate || !tip || !Number.isFinite(odds)) throw new Error("Missing match_date/tip/odds");

  const row: Record<string, unknown> = {
    league: body.league ?? null,
    home_team: body.home_team ?? body.homeTeam ?? null,
    away_team: body.away_team ?? body.awayTeam ?? null,
    prediction_type: body.prediction_type ?? body.predictionType ?? null,
    tip,
    odds,
    confidence: body.confidence ?? null,
    risk_level: body.risk_level ?? body.riskLevel ?? null,
    match_date: matchDate,
    tier_required: body.tier_required ?? body.tierRequired ?? "free",
    source: "n8n",
    created_at: new Date().toISOString(),
  };
  const id = body.id ?? body.prediction_id ?? null;
  if (id != null) row.id = id;

  const { error } = await supabase.from("predictions").upsert(row as never, { onConflict: "id" });
  if (error) throw error;
}

async function processResult(
  supabase: ReturnType<typeof createServiceClient>,
  payload: unknown,
) {
  const body = (payload ?? {}) as Record<string, unknown>;
  const id = body.id ?? body.prediction_id ?? body.predictionId ?? null;
  const result = normalizeResult(String(body.result ?? ""));
  if (!id || !result) throw new Error("Missing id/result");

  const { error } = await supabase
    .from("predictions")
    .update({ result, updated_at: new Date().toISOString() })
    .eq("id", String(id));
  if (error) throw error;
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Body;
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data } = await supabase
      .from("webhook_logs")
      .select("id,webhook_type,payload")
      .eq("id", id)
      .maybeSingle<{ id: string; webhook_type: string; payload: unknown }>();

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const type = String(data.webhook_type ?? "").toLowerCase();
    if (type === "prediction") await processPrediction(supabase, data.payload);
    else if (type === "result") await processResult(supabase, data.payload);
    else throw new Error("Unsupported webhook_type");

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "webhook.reprocess",
      target_type: "webhook_log",
      target_id: id,
      details: { webhook_type: type },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: String((e as Error).message || "Failed") }, { status });
  }
}

