import "server-only";

import { NextResponse } from "next/server";
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

async function insertLog(
  supabase: ReturnType<typeof createServiceClient>,
  row: {
    webhook_type: string;
    payload: unknown;
    status: "success" | "failed";
    error_message?: string | null;
  },
) {
  try {
    await supabase.from("webhook_logs").insert({
      webhook_type: row.webhook_type,
      payload: row.payload,
      status: row.status,
      error_message: row.error_message ?? null,
      received_at: new Date().toISOString(),
    });
  } catch {}
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const payload = await request.json().catch(() => null);

  try {
    const body = (payload ?? {}) as Record<string, unknown>;
    const matchDate = String(body.match_date ?? body.matchDate ?? "").trim();
    const tip = String(body.tip ?? "").trim();
    const odds = Number(body.odds);

    if (!matchDate || !tip || !Number.isFinite(odds)) {
      await insertLog(supabase, {
        webhook_type: "prediction",
        payload,
        status: "failed",
        error_message: "Missing match_date/tip/odds",
      });
      return NextResponse.json({ ok: false }, { status: 400 });
    }

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

    await insertLog(supabase, {
      webhook_type: "prediction",
      payload,
      status: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await insertLog(supabase, {
      webhook_type: "prediction",
      payload,
      status: "failed",
      error_message: String((e as Error).message || "failed"),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

