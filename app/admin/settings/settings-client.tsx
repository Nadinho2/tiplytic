"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type SettingsMap = Record<string, { value: string; updated_at: string | null }>;

type RowDef = {
  key: string;
  label: string;
  kind: "toggle" | "text" | "number" | "url";
  description: string;
};

const FLAGS: RowDef[] = [
  { key: "maintenance_mode", label: "Maintenance mode", kind: "toggle", description: "Show maintenance page to all non-admin users." },
  { key: "community_predictions_enabled", label: "Community predictions enabled", kind: "toggle", description: "Allow/block user prediction submissions." },
  { key: "leaderboard_visible", label: "Leaderboard visible", kind: "toggle", description: "Show/hide tipster leaderboard pages." },
  { key: "daily_challenge_enabled", label: "Daily challenge enabled", kind: "toggle", description: "Show/hide daily challenge widget." },
  { key: "affiliate_signups_open", label: "Affiliate signups open", kind: "toggle", description: "Allow/block new affiliate applications." },
  { key: "free_trial_enabled", label: "Free trial enabled", kind: "toggle", description: "Enable/disable free trials on paid tiers." },
  { key: "announcement_banner_active", label: "Announcement banner active", kind: "toggle", description: "Show/hide the announcement banner." },
];

const CONTENT: RowDef[] = [
  { key: "announcement_banner_text", label: "Announcement banner text", kind: "text", description: "Top banner text across the site (empty = none)." },
  { key: "whatsapp_community_link", label: "WhatsApp community link", kind: "url", description: "Used in footer and CTAs." },
  { key: "tipster_of_month", label: "Tipster of the month", kind: "text", description: "Username shown on homepage." },
];

const LIMITS: RowDef[] = [
  { key: "free_daily_limit", label: "Free daily limit", kind: "number", description: "Predictions free users see per day." },
  { key: "community_daily_limit", label: "Community daily limit", kind: "number", description: "Max community predictions per user per day." },
  { key: "min_odds_for_rank", label: "Min odds for rank", kind: "number", description: "Minimum odds that count toward tipster rank." },
];

function truthy(v: string) {
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes" || v.toLowerCase() === "on";
}

function toToggleValue(v: boolean) {
  return v ? "true" : "false";
}

export function SettingsClient({ initialTab }: { initialTab: string }) {
  const [tab, setTab] = useState(initialTab === "content" ? "content" : initialTab === "limits" ? "limits" : "flags");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/settings", { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { settings?: SettingsMap; error?: string } | null;
      if (cancelled) return;
      if (!res || !res.ok || !json?.settings) {
        toast.error(json?.error || "Failed to load settings");
        setSettings({});
        setDraft({});
        setLoading(false);
        return;
      }
      setSettings(json.settings);
      const d: Record<string, string> = {};
      for (const [k, v] of Object.entries(json.settings)) d[k] = v.value ?? "";
      setDraft(d);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (tab === "content") return CONTENT;
    if (tab === "limits") return LIMITS;
    return FLAGS;
  }, [tab]);

  async function save(key: string) {
    const row = rows.find((r) => r.key === key) ?? null;
    const value = draft[key] ?? "";

    if (row?.kind === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        toast.error("Enter a valid number");
        return;
      }
    }
    if (row?.kind === "url" && value.trim()) {
      try {
        const u = new URL(value.trim());
        if (!u.protocol.startsWith("http")) throw new Error("bad");
      } catch {
        toast.error("Enter a valid URL (https://...)");
        return;
      }
    }

    setSavingKey(key);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSavingKey(null);
    if (!res || !res.ok || !json?.ok) {
      toast.error(json?.error || "Save failed");
      return;
    }
    toast.success("Saved");
    setSettings((prev) => ({ ...prev, [key]: { value, updated_at: new Date().toISOString() } }));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Site settings & feature flags</h1>
        <p className="mt-2 text-sm text-muted">Changes apply immediately.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("flags")}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "flags" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Feature Flags
        </button>
        <button
          type="button"
          onClick={() => setTab("content")}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "content" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Site Content
        </button>
        <button
          type="button"
          onClick={() => setTab("limits")}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "limits" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Limits
        </button>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">
            {tab === "flags" ? "Feature flags" : tab === "content" ? "Site content" : "Limits"}
          </div>
          <div className="mt-1 text-sm text-muted">
            {tab === "flags" ? "Toggle features instantly." : tab === "content" ? "Edit site-wide content." : "Operational limits and thresholds."}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">Loading…</div>
          ) : (
            <div className="space-y-4">
              {rows.map((r) => {
                const value = draft[r.key] ?? settings[r.key]?.value ?? "";
                const isSaving = savingKey === r.key;
                const lastUpdated = settings[r.key]?.updated_at ?? null;
                const toggle = truthy(value);
                return (
                  <div key={r.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{r.label}</div>
                        <div className="mt-1 text-xs text-white/60">{r.description}</div>
                        <div className="mt-2 text-[11px] text-white/40">
                          Key: {r.key}
                          {lastUpdated ? ` • Updated: ${new Date(lastUpdated).toLocaleString()}` : ""}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        {r.kind === "toggle" ? (
                          <button
                            type="button"
                            onClick={() => setDraft((p) => ({ ...p, [r.key]: toToggleValue(!toggle) }))}
                            className={cn(
                              "h-9 w-16 rounded-full border p-1 transition",
                              toggle ? "border-[#3B82F6]/30 bg-[#3B82F6]/30" : "border-white/10 bg-white/5",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-7 w-7 rounded-full bg-white transition",
                                toggle ? "translate-x-7" : "translate-x-0",
                              )}
                            />
                          </button>
                        ) : r.kind === "text" ? (
                          <input
                            value={value}
                            onChange={(e) => setDraft((p) => ({ ...p, [r.key]: e.target.value }))}
                            className="w-full min-w-[240px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none sm:w-[360px]"
                            placeholder="Enter value…"
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={(e) => setDraft((p) => ({ ...p, [r.key]: e.target.value }))}
                            className="w-full min-w-[240px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none sm:w-[240px]"
                            placeholder={r.kind === "number" ? "0" : "https://..."}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => void save(r.key)}
                          disabled={isSaving}
                          className="rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

