import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

function isTier(v: string) {
  return v === "free" || v === "basic" || v === "pro" || v === "elite";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createServiceClient();
  try {
    await requireAdmin();
    const { id } = await params;
    const { data, error } = await supabase.from("predictions").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ prediction: data });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (body.match_title != null) patch.match_title = String(body.match_title || "").trim() || null;
    if (body.league != null) patch.league = String(body.league || "").trim() || null;
    if (body.home_team != null) patch.home_team = String(body.home_team || "").trim() || null;
    if (body.away_team != null) patch.away_team = String(body.away_team || "").trim() || null;
    if (body.prediction_type != null) patch.prediction_type = String(body.prediction_type || "").trim() || null;
    if (body.tip != null) patch.tip = String(body.tip || "").trim();
    if (body.odds != null) patch.odds = Number(body.odds);
    if (body.confidence != null) patch.confidence = Math.max(0, Math.min(100, Math.floor(Number(body.confidence))));
    if (body.risk_level != null) patch.risk_level = String(body.risk_level || "").trim() || null;
    if (body.match_date != null) patch.match_date = String(body.match_date || "").trim() || null;
    if (body.tier_required != null) {
      const tier = String(body.tier_required || "free").toLowerCase();
      if (!isTier(tier)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      patch.tier_required = tier;
    }
    if (body.is_admin_pick != null) patch.is_admin_pick = Boolean(body.is_admin_pick);
    if (body.admin_analysis != null) patch.admin_analysis = String(body.admin_analysis || "").trim() || null;
    if (body.admin_stars != null) patch.admin_stars = Number(body.admin_stars);

    const { data, error } = await supabase
      .from("predictions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "prediction.update",
      target_type: "prediction",
      target_id: String(id),
      details: patch,
    });

    return NextResponse.json({ prediction: data });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const { id } = await params;

    const { error } = await supabase.from("predictions").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "prediction.delete",
      target_type: "prediction",
      target_id: String(id),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}
