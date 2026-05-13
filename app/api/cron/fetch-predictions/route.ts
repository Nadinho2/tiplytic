import "server-only";

import { NextResponse } from "next/server";

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

    await logCronRun(status, result.saved, {
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
    });

    return NextResponse.json({
      success: status === "success",
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
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

