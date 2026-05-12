import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";

import { sendEmail } from "@/lib/send-email";
import AdminWeeklySummaryEmail from "@/emails/AdminWeeklySummaryEmail";

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

function startOfWeekUtc(d: Date) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}

function addDaysUtc(d: Date, days: number) {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt;
}

function formatMonthDay(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(d);
}

type PredictionRow = {
  user_id: string;
  result: string | null;
  profit_loss: number | null;
  stake: number | null;
  created_at: string | null;
};

function computeTopTipster(rows: PredictionRow[]) {
  const perUser = new Map<
    string,
    { wins: number; losses: number; total: number; profit: number; staked: number }
  >();

  for (const r of rows) {
    const res = (r.result ?? "").toLowerCase();
    if (res !== "win" && res !== "loss") continue;
    const cur = perUser.get(r.user_id) ?? { wins: 0, losses: 0, total: 0, profit: 0, staked: 0 };
    cur.total += 1;
    if (res === "win") cur.wins += 1;
    if (res === "loss") cur.losses += 1;
    cur.profit += r.profit_loss ?? 0;
    cur.staked += r.stake ?? 0;
    perUser.set(r.user_id, cur);
  }

  const ranked = Array.from(perUser.entries())
    .map(([userId, s]) => {
      const denom = s.wins + s.losses;
      const winRate = denom > 0 ? (s.wins / denom) * 100 : 0;
      const roi = s.staked > 0 ? (s.profit / s.staked) * 100 : 0;
      return { userId, roi, winRate, total: s.total };
    })
    .filter((r) => r.total >= 5)
    .sort((a, b) => {
      if (b.roi !== a.roi) return b.roi - a.roi;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    });

  return ranked[0]?.userId ?? null;
}

async function tryLog(
  supabase: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
) {
  try {
    await supabase.from("cron_logs").insert(row as never);
  } catch {}
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") || "";
    const headerSecret = request.headers.get("x-cron-secret") || "";
    if (authHeader !== `Bearer ${secret}` && headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || process.env.RESEND_ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "Missing ADMIN_EMAIL" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const thisWeekStart = startOfWeekUtc(now);
  const start = addDaysUtc(thisWeekStart, -7);
  const end = thisWeekStart;

  const startLabel = formatMonthDay(start);
  const endLabel = formatMonthDay(addDaysUtc(end, -1));

  let subsRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("*")
      .limit(50_000);
    subsRows = (data as typeof subsRows | null) ?? [];
  } catch {}

  const activeByTierMap = new Map<string, number>();
  for (const r of subsRows) {
    const tier = String((r as { tier?: unknown }).tier ?? "free").toLowerCase();
    if (!tier || tier === "free") continue;
    const status = String((r as { status?: unknown }).status ?? "active").toLowerCase();
    if (status && status !== "active" && status !== "trialing") continue;
    activeByTierMap.set(tier, (activeByTierMap.get(tier) ?? 0) + 1);
  }
  const activeByTier = Array.from(activeByTierMap.entries())
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => b.count - a.count);

  const newSubscribers = subsRows.filter((r) => {
    const tier = String((r as { tier?: unknown }).tier ?? "free").toLowerCase();
    if (tier === "free") return false;
    const createdAt = (r as { created_at?: unknown }).created_at;
    if (typeof createdAt !== "string") return false;
    return createdAt >= start.toISOString() && createdAt < end.toISOString();
  }).length;

  const churnedSubscribers = subsRows.filter((r) => {
    const tier = String((r as { tier?: unknown }).tier ?? "free").toLowerCase();
    if (tier === "free") return false;
    const status = String((r as { status?: unknown }).status ?? "").toLowerCase();
    if (!status) return false;
    if (status === "active" || status === "trialing") return false;
    const updatedAt = (r as { updated_at?: unknown }).updated_at;
    if (typeof updatedAt !== "string") return false;
    return updatedAt >= start.toISOString() && updatedAt < end.toISOString();
  }).length;

  let revenueLabel = "—";
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("amount,created_at,status")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .limit(50_000);

    const rows = (data as Array<{ amount: number | null; status: string | null }> | null) ?? [];
    const revenue = rows
      .filter((r) => (r.status ?? "").toLowerCase() === "active" || (r.status ?? "").toLowerCase() === "paid")
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);
    if (Number.isFinite(revenue) && revenue > 0) {
      revenueLabel = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }).format(revenue);
    }
  } catch {}

  const { data: predRowsRaw } = await supabase
    .from("community_predictions")
    .select("user_id,result,profit_loss,stake,created_at,odds")
    .gte("odds", 1.5)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(100_000);

  const predRows =
    (predRowsRaw as Array<PredictionRow & { odds?: number | string | null }> | null) ?? [];

  const decided = predRows.filter((r) => {
    const res = (r.result ?? "").toLowerCase();
    return res === "win" || res === "loss";
  });
  const wins = decided.filter((r) => (r.result ?? "").toLowerCase() === "win").length;
  const losses = decided.filter((r) => (r.result ?? "").toLowerCase() === "loss").length;
  const denom = wins + losses;
  const platformWinRate = denom > 0 ? (wins / denom) * 100 : 0;

  const topUserId = computeTopTipster(decided);
  let topTipsterLabel = "—";
  if (topUserId) {
    try {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(topUserId);
      topTipsterLabel = u.username || u.firstName || topUserId;
    } catch {
      topTipsterLabel = topUserId;
    }
  }

  const subject = `Admin Weekly Summary — ${startLabel} to ${endLabel}`;
  const result = await sendEmail({
    to: adminEmail,
    subject,
    react: React.createElement(AdminWeeklySummaryEmail, {
      startLabel,
      endLabel,
      newSubscribers,
      churnedSubscribers,
      activeByTier,
      revenueLabel,
      topTipsterLabel,
      platformWinRate,
      decidedPredictions: denom,
    }),
  });

  await tryLog(supabase, {
    job: "admin_weekly_summary",
    ran_at: new Date().toISOString(),
    status: result.success ? "sent" : "failed",
    meta: { start: start.toISOString(), end: end.toISOString() },
  });

  return NextResponse.json({
    ok: result.success,
    start: start.toISOString(),
    end: end.toISOString(),
  });
}
