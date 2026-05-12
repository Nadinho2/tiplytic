import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  try {
    await supabase
      .from("user_subscriptions")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("clerk_user_id", userId);
  } catch {}

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const current = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...current,
        subscription: {
          ...(current.subscription as Record<string, unknown> | undefined),
          status: "paused",
        },
      },
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
