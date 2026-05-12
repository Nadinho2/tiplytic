import "server-only";

import { NextResponse } from "next/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

const KEYS = [
  "maintenance_mode",
  "community_predictions_enabled",
  "leaderboard_visible",
  "daily_challenge_enabled",
  "affiliate_signups_open",
  "free_trial_enabled",
  "announcement_banner_text",
  "announcement_banner_active",
  "whatsapp_community_link",
  "tipster_of_month",
  "free_daily_limit",
  "community_daily_limit",
  "min_odds_for_rank",
] as const;

type KnownKey = (typeof KEYS)[number];

function isMissingSiteSettingsTableError(message: string) {
  const m = message.toLowerCase();
  if (!m.includes("site_settings")) return false;
  if (m.includes("schema cache")) return true;
  if (m.includes("could not find the table")) return true;
  if (m.includes("relation") && m.includes("does not exist")) return true;
  return false;
}

function emptySettingsMap() {
  const map: Record<string, { value: string; updated_at: string | null }> = {};
  for (const k of KEYS) map[k] = { value: "", updated_at: null };
  return map;
}

export async function GET() {
  const supabase = createServiceClient();
  try {
    await requireAdmin();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key,value,updated_at")
      .in("key", [...KEYS])
      .limit(500);

    if (error && isMissingSiteSettingsTableError(error.message)) {
      return NextResponse.json({
        settings: emptySettingsMap(),
        tableMissing: true,
        error:
          "site_settings table is missing. Create public.site_settings in Supabase and reload schema cache.",
      });
    }

    const rows =
      (data as Array<{ key: string; value: string; updated_at: string | null }> | null) ?? [];

    const map = emptySettingsMap();
    for (const r of rows) {
      if (typeof r.key === "string") map[r.key] = { value: String(r.value ?? ""), updated_at: r.updated_at ?? null };
    }

    return NextResponse.json({ settings: map });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { key?: string; value?: string };
    const key = String(body.key ?? "").trim() as KnownKey;
    if (!KEYS.includes(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });

    const value = String(body.value ?? "");
    const row = { key, value, updated_at: new Date().toISOString() };

    const { error } = await supabase.from("site_settings").upsert(row as never, { onConflict: "key" });
    if (error && isMissingSiteSettingsTableError(error.message)) {
      return NextResponse.json(
        {
          error:
            "site_settings table is missing. Create public.site_settings in Supabase and reload schema cache (notify pgrst, 'reload schema').",
        },
        { status: 501 },
      );
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "settings.update",
      target_type: "site_setting",
      target_id: key,
      details: { value },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}
