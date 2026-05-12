import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

type Body =
  | { action: "bulk_delete"; ids: string[] }
  | { action: "bulk_result"; ids: string[]; result: "win" | "loss" | "void" };

function normalizeResult(v: string) {
  const s = v.trim().toLowerCase();
  if (s === "win" || s === "loss" || s === "void") return s;
  return null;
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Partial<Body> & Record<string, unknown>;
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)) : [];
    if (!ids.length) return NextResponse.json({ error: "Missing ids" }, { status: 400 });

    const action = String(body.action ?? "");
    if (action === "bulk_delete") {
      const { error } = await supabase.from("predictions").delete().in("id", ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await insertAuditLog(supabase, {
        admin_user_id: userId,
        action: "prediction.bulk_delete",
        target_type: "prediction",
        details: { count: ids.length },
      });

      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    if (action === "bulk_result") {
      const result = normalizeResult(String(body.result ?? "")) as "win" | "loss" | "void" | null;
      if (!result) return NextResponse.json({ error: "Invalid result" }, { status: 400 });

      const { error } = await supabase
        .from("predictions")
        .update({ result, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await insertAuditLog(supabase, {
        admin_user_id: userId,
        action: "prediction.bulk_update_result",
        target_type: "prediction",
        details: { count: ids.length, result },
      });

      return NextResponse.json({ ok: true, updated: ids.length, result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

