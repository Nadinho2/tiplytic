import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { auth } from "@clerk/nextjs/server";

function requiredPublicEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getSupabasePublicConfig() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return {
    url: requiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey:
      publishableKey || requiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export async function createServerComponentClient(): Promise<SupabaseClient> {
  const { url, anonKey } = getSupabasePublicConfig();
  const { userId, getToken } = await auth();
  const accessToken = userId
    ? await getToken({ template: "supabase" }).catch(() => null)
    : null;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}
