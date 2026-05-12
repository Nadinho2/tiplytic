import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, requireAdmin } from "@/lib/admin";

function asLower(v: string | null) {
  return String(v ?? "").trim().toLowerCase();
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = asLower(url.searchParams.get("status"));
    const type = asLower(url.searchParams.get("type"));
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const supabase = createServiceClient();
    let q = supabase
      .from("webhook_logs")
      .select("id,webhook_type,payload,status,error_message,received_at", { count: "exact" })
      .order("received_at", { ascending: false })
      .limit(100);

    if (status === "success" || status === "failed") q = q.eq("status", status);
    if (type) q = q.eq("webhook_type", type);
    if (from) q = q.gte("received_at", from);
    if (to) q = q.lte("received_at", to);

    const { data, count, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ rows: data ?? [], total: count ?? 0 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

