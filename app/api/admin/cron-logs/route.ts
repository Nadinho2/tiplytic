import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, requireAdmin } from "@/lib/admin";

type CronRow = {
  id: string;
  job: string;
  status: string;
  details: unknown;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const job = String(url.searchParams.get("job") ?? "daily_predictions_fetch");
    const status = url.searchParams.get("status");
    const rawLimit = Number(url.searchParams.get("limit") ?? 30);
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));

    const supabase = createServiceClient();

    let q = supabase
      .from("cron_logs")
      .select("id,job,status,details,created_at")
      .eq("job", job)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && (status === "success" || status === "failed")) {
      q = q.eq("status", status);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data as CronRow[] | null) ?? [];
    const lastSuccess = rows.find((r) => String(r.status).toLowerCase() === "success") ?? null;

    return NextResponse.json({ rows, lastSuccess });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}
