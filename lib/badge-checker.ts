import "server-only";

import React from "react";
import { clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { BADGES, type BadgeKey } from "@/lib/badges";
import { calculateStreak } from "@/lib/stats-engine";
import { sendEmail } from "@/lib/send-email";
import BadgeEarnedEmail from "@/emails/BadgeEarnedEmail";

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

function parseOdds(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function longestConsecutiveDayRun(days: string[]) {
  if (!days.length) return 0;
  const uniq = Array.from(new Set(days)).sort();
  let best = 1;
  let run = 1;

  for (let i = 1; i < uniq.length; i += 1) {
    const prev = new Date(`${uniq[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${uniq[i]}T00:00:00Z`).getTime();
    const diffDays = Math.round((cur - prev) / 86_400_000);
    if (diffDays === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

async function getExistingBadges(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<{ column: "badge_key" | "badge"; keys: Set<string> }> {
  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("badge_key")
      .eq("user_id", userId);
    if (!error) {
      const keys = new Set(
        ((data as Array<{ badge_key: string | null }> | null) ?? [])
          .map((r) => r.badge_key)
          .filter(Boolean) as string[],
      );
      return { column: "badge_key", keys };
    }
  } catch {}

  const { data } = await supabase
    .from("user_badges")
    .select("badge")
    .eq("user_id", userId);
  const keys = new Set(
    ((data as Array<{ badge: string | null }> | null) ?? [])
      .map((r) => r.badge)
      .filter(Boolean) as string[],
  );
  return { column: "badge", keys };
}

async function upsertBadges(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  column: "badge_key" | "badge",
  keys: BadgeKey[],
) {
  if (!keys.length) return;
  const now = new Date().toISOString();
  const rows = keys.map((k) => ({
    user_id: userId,
    [column]: k,
    awarded_at: now,
  }));

  await supabase.from("user_badges").upsert(rows as never, {
    onConflict: `user_id,${column}`,
    ignoreDuplicates: true,
  });
}

async function maybeSendMilestoneEmails(userId: string, newlyAwarded: BadgeKey[]) {
  const milestones = new Set<BadgeKey>(["five_streak", "ten_streak", "double_bankroll"]);
  const toSend = newlyAwarded.filter((k) => milestones.has(k));
  if (!toSend.length) return;

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const to = user.primaryEmailAddress?.emailAddress;
  const username = user.firstName || user.username || "Tipster";
  if (!to) return;

  for (const key of toSend) {
    const badge = BADGES[key];
    const subject = `${badge.emoji} New badge unlocked: ${badge.label}!`;

    await sendEmail({
      to,
      subject,
      react: React.createElement(BadgeEarnedEmail, {
        username,
        badgeName: badge.label,
        badgeDescription: badge.description,
      }),
    });
  }
}

async function getTopTenStatus(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<boolean> {
  const tables = ["leaderboard", "tipster_leaderboard", "leaderboard_monthly"];
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("rank")
        .eq("user_id", userId)
        .maybeSingle<{ rank: number | null }>();
      if (!error && typeof data?.rank === "number") return data.rank <= 10;
    } catch {}
  }
  return false;
}

export async function checkAndAwardBadges(userId: string): Promise<BadgeKey[]> {
  const supabase = createServiceClient();

  const [{ column, keys: existing }, totalPredictions, streakStats, rows, bankroll, topTen, subscription] =
    await Promise.all([
      getExistingBadges(supabase, userId),
      (async () => {
        try {
          const { count } = await supabase
            .from("community_predictions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
          return count ?? 0;
        } catch {
          const { data } = await supabase
            .from("community_predictions")
            .select("id")
            .eq("user_id", userId)
            .limit(2000);
          return ((data as Array<{ id: string | number }> | null) ?? []).length;
        }
      })(),
      (async () => {
        const { data } = await supabase
          .from("community_predictions")
          .select("created_at,result")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1000);
        const preds =
          (data as Array<{ created_at: string | null; result: string | null }> | null) ?? [];
        return calculateStreak(
          preds.map((p, idx) => ({
            id: idx,
            user_id: userId,
            created_at: p.created_at,
            result: p.result,
          })),
        );
      })(),
      (async () => {
        const { data } = await supabase
          .from("community_predictions")
          .select("created_at,result,odds")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5000);
        return (
          (data as Array<{
            created_at: string | null;
            result: string | null;
            odds: number | string | null;
          }> | null) ?? []
        );
      })(),
      (async () => {
        try {
          const { data } = await supabase
            .from("virtual_bankrolls")
            .select("starting_balance,peak_balance,current_balance")
            .eq("user_id", userId)
            .maybeSingle<{
              starting_balance: number | null;
              peak_balance: number | null;
              current_balance: number | null;
            }>();
          return data ?? null;
        } catch {
          return null;
        }
      })(),
      getTopTenStatus(supabase, userId),
      (async () => {
        try {
          const { data } = await supabase
            .from("user_subscriptions")
            .select("tier,status,interval")
            .eq("clerk_user_id", userId)
            .maybeSingle<{ tier: string | null; status: string | null; interval?: string | null }>();
          return data ?? null;
        } catch {
          return null;
        }
      })(),
    ]);

  const decided = rows.filter((r) => r.result === "win" || r.result === "loss");
  const wins = decided.filter((r) => r.result === "win");

  const days = rows
    .map((r) => (r.created_at ? r.created_at.slice(0, 10) : null))
    .filter(Boolean) as string[];
  const bestDailyRun = longestConsecutiveDayRun(days);

  const hasBoldPick = wins.some((r) => {
    const o = parseOdds(r.odds);
    return typeof o === "number" && o >= 3;
  });

  const starting = bankroll?.starting_balance ?? 10_000;
  const peak = bankroll?.peak_balance ?? bankroll?.current_balance ?? starting;
  const doubledBankroll = typeof peak === "number" && peak >= starting * 2;

  const eligible: BadgeKey[] = [];
  if (totalPredictions >= 1) eligible.push("first_prediction");
  if (totalPredictions >= 50) eligible.push("fifty_predictions");
  if (totalPredictions >= 500) eligible.push("legend");
  if (hasBoldPick) eligible.push("bold_pick");
  if (bestDailyRun >= 30) eligible.push("consistent");
  if (doubledBankroll) eligible.push("double_bankroll");
  if (topTen) eligible.push("africa_giant");
  if (
    subscription &&
    String(subscription.status ?? "").toLowerCase() === "active" &&
    String(subscription.tier ?? "").toLowerCase() !== "free"
  ) {
    const interval = String(subscription.interval ?? "").toLowerCase();
    if (interval === "annual") eligible.push("annual_member");
    else {
      try {
        const { data } = await supabase
          .from("user_subscriptions")
          .select("expires_at")
          .eq("clerk_user_id", userId)
          .maybeSingle<{ expires_at: string | null }>();
        const exp = data?.expires_at ? new Date(data.expires_at).getTime() : null;
        if (exp && exp - Date.now() >= 330 * 86_400_000) eligible.push("annual_member");
      } catch {}
    }
  }

  if (streakStats.type === "win" && streakStats.current >= 5) eligible.push("five_streak");
  if (streakStats.type === "win" && streakStats.current >= 10) eligible.push("ten_streak");

  const newlyAwarded = eligible.filter((k) => !existing.has(k));
  if (newlyAwarded.length) {
    await upsertBadges(supabase, userId, column, newlyAwarded);
    await maybeSendMilestoneEmails(userId, newlyAwarded);
  }

  return newlyAwarded;
}

export async function getEarnedBadges(userId: string): Promise<BadgeKey[]> {
  const supabase = createServiceClient();
  const { keys } = await getExistingBadges(supabase, userId);
  return Array.from(keys).filter((k): k is BadgeKey => k in BADGES);
}
