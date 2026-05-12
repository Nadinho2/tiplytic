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

function normalizeResult(v: string) {
  const s = v.trim().toLowerCase();
  if (s === "win" || s === "loss" || s === "void") return s;
  return null;
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const payload = await request.json().catch(() => null);

  try {
    const body = (payload ?? {}) as Record<string, unknown>;
    const id = body.id ?? body.prediction_id ?? body.predictionId ?? null;
    const result = normalizeResult(String(body.result ?? ""));
    if (!id || !result) {
      await insertLog(supabase, {
        webhook_type: "result",
        payload,
        status: "failed",
        error_message: "Missing id/result",
      });
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabase
      .from("predictions")
      .update({ result, updated_at: new Date().toISOString() })
      .eq("id", String(id));
    if (error) throw error;

    await insertLog(supabase, {
      webhook_type: "result",
      payload,
      status: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await insertLog(supabase, {
      webhook_type: "result",
      payload,
      status: "failed",
      error_message: String((e as Error).message || "failed"),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

