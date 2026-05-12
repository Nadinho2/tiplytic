import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

function clampInt(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function asLower(v: string | null) {
  return String(v ?? "").trim().toLowerCase();
}

function isTier(v: string) {
  return v === "free" || v === "basic" || v === "pro" || v === "elite";
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const result = asLower(url.searchParams.get("result"));
    const tier = asLower(url.searchParams.get("tier"));
    const league = url.searchParams.get("league");
    const isAdminPick = asLower(url.searchParams.get("is_admin_pick"));
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const page = clampInt(url.searchParams.get("page"), 0);
    const pageSize = 25;
    const sort = url.searchParams.get("sort") ?? "match_date";
    const dir = asLower(url.searchParams.get("dir")) === "asc" ? "asc" : "desc";

    const supabase = createServiceClient();
    let query = supabase
      .from("predictions")
      .select(
        "id,league,home_team,away_team,prediction_type,tip,odds,tier_required,is_admin_pick,match_date,result,source,created_at,admin_analysis,admin_stars,admin_rating,confidence,risk_level",
        { count: "exact" },
      );

    if (q && q.trim()) {
      const needle = q.trim();
      query = query.or(`home_team.ilike.%${needle}%,away_team.ilike.%${needle}%,league.ilike.%${needle}%,tip.ilike.%${needle}%`);
    }
    if (result && (result === "pending" || result === "win" || result === "loss" || result === "void")) {
      query = query.eq("result", result);
    }
    if (tier && isTier(tier)) {
      query = query.eq("tier_required", tier);
    }
    if (league && league.trim() && league !== "All") {
      query = query.eq("league", league);
    }
    if (isAdminPick === "true") query = query.eq("is_admin_pick", true);
    if (isAdminPick === "false") query = query.eq("is_admin_pick", false);
    if (from) query = query.gte("match_date", from);
    if (to) query = query.lte("match_date", to);

    const sortable = new Set([
      "match_date",
      "created_at",
      "odds",
      "league",
      "result",
      "tier_required",
      "is_admin_pick",
    ]);
    const sortCol = sortable.has(sort) ? sort : "match_date";
    query = query.order(sortCol, { ascending: dir === "asc" });

    const fromIdx = page * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    const { data, count, error } = await query.range(fromIdx, toIdx);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    return NextResponse.json({ rows, total: count ?? 0, page, pageSize });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const matchTitle = String(body.match_title ?? "").trim();
    const league = String(body.league ?? "").trim() || null;
    const homeTeam = String(body.home_team ?? "").trim() || null;
    const awayTeam = String(body.away_team ?? "").trim() || null;
    const predictionType = String(body.prediction_type ?? "").trim() || null;
    const tip = String(body.tip ?? "").trim();
    const odds = Number(body.odds);
    const confidence = body.confidence == null ? null : Math.max(0, Math.min(100, Math.floor(Number(body.confidence))));
    const riskLevel = body.risk_level ? String(body.risk_level) : null;
    const matchDate = String(body.match_date ?? "").trim();
    const tierRequired = String(body.tier_required ?? "free").toLowerCase();
    const isAdminPick = Boolean(body.is_admin_pick);
    const adminAnalysis = body.admin_analysis ? String(body.admin_analysis) : null;
    const adminStars = body.admin_stars == null ? null : Math.max(1, Math.min(5, Math.floor(Number(body.admin_stars))));

    if (!tip) return NextResponse.json({ error: "Tip is required" }, { status: 400 });
    if (!Number.isFinite(odds) || odds < 1.01) {
      return NextResponse.json({ error: "Odds must be 1.01+" }, { status: 400 });
    }
    if (!matchDate) return NextResponse.json({ error: "Match date is required" }, { status: 400 });
    if (!isTier(tierRequired)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    if (isAdminPick && (!adminAnalysis || adminAnalysis.trim().length < 50)) {
      return NextResponse.json({ error: "Admin analysis must be at least 50 characters" }, { status: 400 });
    }
    if (isAdminPick && !adminStars) {
      return NextResponse.json({ error: "Admin stars are required" }, { status: 400 });
    }

    const insertRow: Record<string, unknown> = {
      league,
      home_team: homeTeam,
      away_team: awayTeam,
      prediction_type: predictionType,
      tip,
      odds,
      confidence,
      risk_level: riskLevel,
      match_date: matchDate,
      tier_required: tierRequired,
      is_admin_pick: isAdminPick,
      admin_analysis: isAdminPick ? adminAnalysis : null,
      admin_stars: isAdminPick ? adminStars : null,
      source: "manual",
      created_at: new Date().toISOString(),
    };

    if (matchTitle) insertRow.match_title = matchTitle;

    const { data, error } = await supabase
      .from("predictions")
      .insert(insertRow as never)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "prediction.create",
      target_type: "prediction",
      target_id: String((data as { id?: unknown } | null)?.id ?? ""),
      details: insertRow,
    });

    return NextResponse.json({ prediction: data });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

