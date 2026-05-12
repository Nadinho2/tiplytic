import "server-only";

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
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

function startOfWeekUtc(d: Date) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const day = dt.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}

type ClerkUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

function toUsername(u: ClerkUser) {
  const base = u.username || [u.firstName, u.lastName].filter(Boolean).join("").toLowerCase();
  return base || u.id;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const week = url.searchParams.get("week") === "prev" ? "prev" : "current";

  const now = new Date();
  const start = startOfWeekUtc(now);
  if (week === "prev") start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("challenge_entries")
    .select("user_id,points_earned,created_at")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .limit(50_000);

  const rows =
    (data as Array<{ user_id: string; points_earned: number | null }> | null) ?? [];

  const scores = new Map<string, number>();
  for (const r of rows) {
    const cur = scores.get(r.user_id) ?? 0;
    scores.set(r.user_id, cur + (r.points_earned ?? 0));
  }

  const sorted = Array.from(scores.entries())
    .map(([userId, points]) => ({ userId, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 50);

  const userIds = sorted.map((s) => s.userId).slice(0, 100);
  const clerk = await clerkClient();
  const usersResponse = (await clerk.users.getUserList({
    userId: userIds,
    limit: Math.min(500, userIds.length || 1),
  })) as unknown as { data: ClerkUser[] };
  const users = usersResponse.data ?? [];
  const meta = new Map<string, { username: string }>();
  for (const u of users) meta.set(u.id, { username: toUsername(u) });

  return NextResponse.json({
    week,
    start: start.toISOString(),
    end: end.toISOString(),
    rows: sorted.map((s, idx) => ({
      rank: idx + 1,
      userId: s.userId,
      username: meta.get(s.userId)?.username ?? s.userId,
      points: s.points,
    })),
  });
}
