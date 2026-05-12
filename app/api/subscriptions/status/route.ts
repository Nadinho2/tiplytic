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

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_subscriptions")
    .select("tier,status,expires_at")
    .eq("clerk_user_id", userId)
    .maybeSingle<{ tier: string | null; status: string | null; expires_at: string | null }>();

  return NextResponse.json({
    tier: data?.tier ?? "free",
    status: data?.status ?? "active",
    expires_at: data?.expires_at ?? null,
  });
}

