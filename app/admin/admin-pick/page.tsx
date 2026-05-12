import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { AdminPickClient } from "./admin-pick-client";

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

function addDaysUtc(d: Date, days: number) {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt;
}

type PredictionRow = {
  id: string | number;
  league: string | null;
  home_team: string | null;
  away_team: string | null;
  tip: string | null;
  odds: number | null;
  match_date: string | null;
  result: string | null;
  is_admin_pick: boolean | null;
  admin_analysis: string | null;
  admin_stars: number | null;
};

type AdminPickStatsRow = {
  total_picks: number | null;
  total_wins: number | null;
  total_losses: number | null;
  current_streak: number | null;
  best_streak: number | null;
  updated_at: string | null;
};

export default async function Page() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  const supabase = createServiceClient();
  const now = new Date();
  const end = addDaysUtc(now, 7).toISOString();

  const { data: upcoming } = await supabase
    .from("predictions")
    .select("id,league,home_team,away_team,tip,odds,match_date,result,is_admin_pick,admin_analysis,admin_stars")
    .gte("match_date", now.toISOString())
    .lt("match_date", end)
    .order("match_date", { ascending: true })
    .limit(500);

  const upcomingRows = (upcoming as PredictionRow[] | null) ?? [];
  const currentPick = upcomingRows.find((p) => Boolean(p.is_admin_pick)) ?? null;

  const { data: statsRows } = await supabase
    .from("admin_pick_stats")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);
  const stats = (statsRows?.[0] as AdminPickStatsRow | undefined) ?? null;

  const { data: last } = await supabase
    .from("predictions")
    .select("id,home_team,away_team,tip,odds,result,match_date")
    .eq("is_admin_pick", true)
    .order("match_date", { ascending: false })
    .limit(20);

  const lastRows =
    (last as Array<{
      id: string | number;
      home_team: string | null;
      away_team: string | null;
      tip: string | null;
      odds: number | null;
      result: string | null;
      match_date: string | null;
    }> | null) ?? [];

  return (
    <AdminPickClient upcoming={upcomingRows} currentPick={currentPick} stats={stats} last={lastRows} />
  );
}

