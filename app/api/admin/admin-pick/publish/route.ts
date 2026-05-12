import "server-only";

import { NextResponse } from "next/server";

import { calculateStreak, type CommunityPrediction } from "@/lib/stats-engine";
import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

type Body = {
  predictionId?: string;
  adminAnalysis?: string;
  adminStars?: number;
};

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function startOfTomorrowUtc(d: Date) {
  const dt = startOfUtcDay(d);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}

async function recalcAdminPickStats(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from("predictions")
    .select("created_at,result")
    .eq("is_admin_pick", true)
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = (data as Array<{ created_at: string | null; result: string | null }> | null) ?? [];
  const decided = rows.filter((r) => r.result === "win" || r.result === "loss");
  const wins = decided.filter((r) => r.result === "win").length;
  const losses = decided.filter((r) => r.result === "loss").length;
  const total = wins + losses;

  const streak = calculateStreak(
    rows.map((r, idx) => ({
      id: idx,
      user_id: "admin",
      created_at: r.created_at,
      result: r.result,
    })) as unknown as CommunityPrediction[],
  );

  await supabase.from("admin_pick_stats").insert({
    total_picks: total,
    total_wins: wins,
    total_losses: losses,
    current_streak: streak.current,
    best_streak: streak.longest,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Body;
    const predictionId = String(body.predictionId ?? "").trim();
    const adminAnalysis = String(body.adminAnalysis ?? "").trim();
    const adminStars = Number(body.adminStars ?? 0);

    if (!predictionId) return NextResponse.json({ error: "Missing predictionId" }, { status: 400 });
    if (adminAnalysis.length < 50) {
      return NextResponse.json({ error: "Admin analysis must be at least 50 characters" }, { status: 400 });
    }
    if (!Number.isFinite(adminStars) || adminStars < 1 || adminStars > 5) {
      return NextResponse.json({ error: "Admin stars must be 1-5" }, { status: 400 });
    }

    const now = new Date();
    const start = startOfUtcDay(now).toISOString();
    const end = startOfTomorrowUtc(now).toISOString();

    const { data: existing } = await supabase
      .from("predictions")
      .select("id")
      .eq("is_admin_pick", true)
      .gte("match_date", start)
      .lt("match_date", end)
      .limit(1);

    const already = (existing as Array<{ id: string | number }> | null)?.[0]?.id ?? null;
    if (already && String(already) !== predictionId) {
      return NextResponse.json(
        { error: "An Admin Pick already exists for today" },
        { status: 409 },
      );
    }

    await supabase
      .from("predictions")
      .update({ is_admin_pick: false })
      .eq("is_admin_pick", true)
      .gte("match_date", start)
      .lt("match_date", end);

    const { data, error } = await supabase
      .from("predictions")
      .update({
        is_admin_pick: true,
        admin_analysis: adminAnalysis,
        admin_stars: adminStars,
        updated_at: new Date().toISOString(),
      })
      .eq("id", predictionId)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    try {
      await recalcAdminPickStats(supabase);
    } catch {}

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "admin_pick.publish",
      target_type: "prediction",
      target_id: predictionId,
      details: { adminStars },
    });

    return NextResponse.json({ ok: true, prediction: data });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

