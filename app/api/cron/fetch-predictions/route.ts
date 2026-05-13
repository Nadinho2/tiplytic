import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/admin";
import {
  fetchPredictionsFromN8N,
  logCronRun,
  notifyAdminOfCronFailure,
  savePredictionsToSupabase,
} from "@/lib/n8n-service";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapPredictions(n8nResponse: unknown): unknown[] {
  if (Array.isArray(n8nResponse)) return n8nResponse;
  if (isRecord(n8nResponse)) {
    if (Array.isArray(n8nResponse.predictions)) return n8nResponse.predictions;
    if (Array.isArray(n8nResponse.data)) return n8nResponse.data;
    return [n8nResponse];
  }
  return [];
}

async function preWarmOddsCache() {
  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl) return { warmed: 0 };

  // Get today's predictions that don't have cached odds yet
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();

  const { data: predictions } = await supabase
    .from("predictions")
    .select("id")
    .gte("match_date", start)
    .lte("match_date", end)
    .limit(50);

  if (!predictions?.length) return { warmed: 0 };

  let warmed = 0;
  for (const prediction of predictions) {
    try {
      await fetch(`${appUrl}/api/odds?match_id=${prediction.id}`);
      warmed++;
    } catch {}
    // Small delay to avoid hitting API rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { warmed };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization") || "";
    const given = request.headers.get("x-cron-secret") || "";
    if (authHeader !== `Bearer ${cronSecret}` && given !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const n8nResponse = await fetchPredictionsFromN8N();
    const predictions = unwrapPredictions(n8nResponse);

    const result = await savePredictionsToSupabase(predictions);
    const status = result.errors.length ? "failed" : "success";

    // Pre-warm odds cache for today's predictions
    let oddsWarmed = 0;
    try {
      const warmResult = await preWarmOddsCache();
      oddsWarmed = warmResult.warmed;
    } catch {}

    await logCronRun(status, result.saved, {
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
      odds_warmed: oddsWarmed,
    });

    return NextResponse.json({
      success: status === "success",
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
      odds_warmed: oddsWarmed,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cron failed";
    await logCronRun("failed", 0, { error: message });
    await notifyAdminOfCronFailure(message);
    return NextResponse.json(
      { success: false, error: message, ran_at: new Date().toISOString() },
      { status: 500 },
    );
  }
}


