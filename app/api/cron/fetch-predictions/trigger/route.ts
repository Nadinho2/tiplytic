import "server-only";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { fetchPredictionsFromN8N, logCronRun, savePredictionsToSupabase } from "@/lib/n8n-service";

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

export async function POST() {
  try {
    await requireAdmin();

    const n8nResponse = await fetchPredictionsFromN8N();
    const predictions = unwrapPredictions(n8nResponse);

    const result = await savePredictionsToSupabase(predictions);
    const status = result.errors.length ? "failed" : "success";

    await logCronRun(status, result.saved, {
      manual: true,
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
    });

    return NextResponse.json({
      success: status === "success",
      message: "Manual trigger completed",
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : "Manual trigger failed";
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

