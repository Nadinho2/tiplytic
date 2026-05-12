import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

type Body = { matchId: string };

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const matchId = String(body.matchId || "").trim();
  if (!matchId) return NextResponse.json({ error: "Missing matchId" }, { status: 400 });

  const supabase = createServiceClient();
  const today = toIsoDate(new Date());

  const { data: existing } = await supabase
    .from("daily_challenges")
    .select("id")
    .eq("challenge_date", today)
    .maybeSingle<{ id: string }>();

  const payload = {
    challenge_date: today,
    match_id: matchId,
    correct_tip: null,
    participants: 0,
    correct_count: 0,
  };

  const { data, error } = existing?.id
    ? await supabase
        .from("daily_challenges")
        .update(payload)
        .eq("id", existing.id)
        .select("id,challenge_date,match_id")
        .maybeSingle()
    : await supabase
        .from("daily_challenges")
        .insert(payload)
        .select("id,challenge_date,match_id")
        .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to set challenge" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, challenge: data });
}

