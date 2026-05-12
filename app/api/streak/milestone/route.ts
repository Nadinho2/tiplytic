import "server-only";

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

import { calculateStreak } from "@/lib/stats-engine";

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

type Body = { userId: string };

export async function POST(request: Request) {
  const secret = process.env.STREAK_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = request.headers.get("x-webhook-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await request.json()) as Body;
  if (!body.userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return NextResponse.json(
      { ok: false, error: "Resend not configured" },
      { status: 501 },
    );
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("community_predictions")
    .select("created_at,result")
    .eq("user_id", body.userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const predictions =
    (data as Array<{ created_at: string | null; result: string | null }> | null) ??
    [];

  const streak = calculateStreak(
    predictions.map((p, idx) => ({
      id: idx,
      user_id: body.userId,
      created_at: p.created_at,
      result: p.result,
    })),
  );

  if (streak.type !== "win") return NextResponse.json({ ok: true, sent: false });

  const milestones = new Set([5, 10, 20]);
  if (!milestones.has(streak.current)) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const decided = predictions.filter((p) => p.result === "win" || p.result === "loss");
  const wins = decided.filter((p) => p.result === "win").length;
  const losses = decided.filter((p) => p.result === "loss").length;
  const denom = wins + losses;
  const winRate = denom > 0 ? (wins / denom) * 100 : 0;

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(body.userId);
  const to = user.primaryEmailAddress?.emailAddress;
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "No email address" },
      { status: 400 },
    );
  }

  const resend = new Resend(apiKey);
  const subject = `🔥 You're on a ${streak.current}-win streak!`;
  const dashboardUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      : "http://localhost:3000/dashboard";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5;">
      <h2 style="margin:0 0 10px;">${subject}</h2>
      <p style="margin:0 0 10px;">
        Keep it going — you’re currently on a <b>${streak.current}-win streak</b>.
      </p>
      <p style="margin:0 0 10px;">
        Current win rate: <b>${(Math.round(winRate * 10) / 10).toFixed(1)}%</b>
      </p>
      <p style="margin:16px 0 0;">
        <a href="${dashboardUrl}" style="color:#3B82F6; font-weight:600;">Open your dashboard</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  return NextResponse.json({ ok: true, sent: true, streak: streak.current });
}
