import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function createServiceClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) {
    const err = new Error("Forbidden");
    (err as { status?: number }).status = 403;
    throw err;
  }
  return { userId };
}

export async function insertAuditLog(
  supabase: ReturnType<typeof createServiceClient>,
  row: {
    admin_user_id: string;
    action: string;
    target_type?: string | null;
    target_id?: string | null;
    details?: unknown;
  },
) {
  try {
    await supabase.from("admin_audit_log").insert({
      admin_user_id: row.admin_user_id,
      action: row.action,
      target_type: row.target_type ?? null,
      target_id: row.target_id ?? null,
      details: row.details ?? null,
      performed_at: new Date().toISOString(),
    });
  } catch {}
}

export async function getSiteSetting(
  supabase: ReturnType<typeof createServiceClient>,
  key: string,
) {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: string }>();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

