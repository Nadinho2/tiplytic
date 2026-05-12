import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/send-email";
import ChallengeWonEmail from "@/emails/ChallengeWonEmail";

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

const OPTIONS = ["Home Win", "Draw", "Away Win"] as const;
type Option = (typeof OPTIONS)[number];

function isOption(value: string): value is Option {
  return (OPTIONS as readonly string[]).includes(value);
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pointsForOdds(odds: number) {
  if (odds >= 3) return 30;
  if (odds >= 2) return 20;
  return 10;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { correctTip?: string };
  const correctTip = String(body.correctTip || "").trim();
  if (!isOption(correctTip)) {
    return NextResponse.json({ error: "Invalid correctTip" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const today = toIsoDate(new Date());

  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("id,match_id")
    .eq("challenge_date", today)
    .maybeSingle<{ id: string; match_id: string | number | null }>();

  if (!challenge?.id || !challenge.match_id) {
    return NextResponse.json({ error: "No active challenge" }, { status: 404 });
  }

  const { data: match } = await supabase
    .from("predictions")
    .select("odds")
    .eq("id", String(challenge.match_id))
    .maybeSingle<{ odds: number | string | null }>();

  const oddsNum = Number(match?.odds ?? 0);
  const points = Number.isFinite(oddsNum) && oddsNum > 0 ? pointsForOdds(oddsNum) : 10;

  await supabase
    .from("daily_challenges")
    .update({ correct_tip: correctTip })
    .eq("id", challenge.id);

  await supabase
    .from("challenge_entries")
    .update({ is_correct: true, points_earned: points })
    .eq("challenge_id", challenge.id)
    .eq("tip", correctTip);

  await supabase
    .from("challenge_entries")
    .update({ is_correct: false, points_earned: 0 })
    .eq("challenge_id", challenge.id)
    .neq("tip", correctTip);

  const { count: participants } = await supabase
    .from("challenge_entries")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challenge.id);

  const { count: correctCount } = await supabase
    .from("challenge_entries")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challenge.id)
    .eq("is_correct", true);

  await supabase
    .from("daily_challenges")
    .update({
      participants: participants ?? 0,
      correct_count: correctCount ?? 0,
    })
    .eq("id", challenge.id);

  // Send emails to the winners
  try {
    const { data: winners } = await supabase
      .from("challenge_entries")
      .select("user_id")
      .eq("challenge_id", challenge.id)
      .eq("is_correct", true);
      
    if (winners && winners.length > 0) {
      // Find match name for context if needed, fallback to "Daily Challenge"
      const matchName = "Today's Daily Challenge";
      
      for (const winner of winners) {
        try {
          const clerk = await clerkClient();
          const user = await clerk.users.getUser(winner.user_id);
          const email = user.primaryEmailAddress?.emailAddress;
          if (email) {
            await sendEmail({
              to: email,
              subject: `You won the Challenge! 🎯`,
              react: React.createElement(ChallengeWonEmail, {
                username: user.firstName || user.username || "Tipster",
                challengeName: matchName,
                pointsEarned: points,
              }),
            });
          }
        } catch (e) {
          console.error(`Failed to send challenge win email to ${winner.user_id}`, e);
        }
      }
    }
  } catch (e) {
    console.error("Failed to process challenge winners emails", e);
  }

  return NextResponse.json({
    ok: true,
    correctTip,
    participants: participants ?? 0,
    correctCount: correctCount ?? 0,
    points,
  });
}
