"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type PredictionRow = {
  id: string | number;
  league: string | null;
  home_team: string | null;
  away_team: string | null;
  tip: string | null;
  odds: number | null;
  match_date: string | null;
  result: string | null;
  is_admin_pick: boolean | null;
  admin_analysis: string | null;
  admin_stars: number | null;
};

type AdminPickStatsRow = {
  total_picks: number | null;
  total_wins: number | null;
  total_losses: number | null;
  current_streak: number | null;
  best_streak: number | null;
  updated_at: string | null;
} | null;

type LastRow = {
  id: string | number;
  home_team: string | null;
  away_team: string | null;
  tip: string | null;
  odds: number | null;
  result: string | null;
  match_date: string | null;
};

function formatMatchTitle(p: { home_team: string | null; away_team: string | null }) {
  return `${p.home_team ?? "Home"} vs ${p.away_team ?? "Away"}`;
}

function ResultBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls =
    v === "win"
      ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
      : v === "loss"
        ? "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
        : v === "void"
          ? "border-white/10 bg-white/[0.03] text-white/70"
          : "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#F59E0B]";
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", cls)}>{value.toUpperCase()}</span>;
}

export function AdminPickClient({
  upcoming,
  currentPick,
  stats,
  last,
}: {
  upcoming: PredictionRow[];
  currentPick: PredictionRow | null;
  stats: AdminPickStatsRow;
  last: LastRow[];
}) {
  const [predictionId, setPredictionId] = useState<string>(() => String(currentPick?.id ?? (upcoming[0]?.id ?? "")));
  const selected = useMemo(() => upcoming.find((p) => String(p.id) === predictionId) ?? null, [predictionId, upcoming]);
  const [analysis, setAnalysis] = useState<string>(currentPick?.admin_analysis ?? "");
  const [stars, setStars] = useState<number>(currentPick?.admin_stars ?? 4);
  const [saving, setSaving] = useState(false);

  async function publish() {
    if (!predictionId) return;
    if (analysis.trim().length < 50) {
      toast.error("Admin analysis must be at least 50 characters");
      return;
    }
    if (stars < 1 || stars > 5) {
      toast.error("Stars must be 1-5");
      return;
    }

    const ok = window.confirm("Publish this as Today's Admin Pick?");
    if (!ok) return;

    setSaving(true);
    const res = await fetch("/api/admin/admin-pick/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ predictionId, adminAnalysis: analysis, adminStars: stars }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!res || !res.ok) {
      toast.error(json?.error || "Publish failed");
      return;
    }
    toast.success("Admin Pick published");
    window.location.reload();
  }

  const winRate =
    (stats?.total_wins ?? 0) + (stats?.total_losses ?? 0) > 0
      ? (((stats?.total_wins ?? 0) / ((stats?.total_wins ?? 0) + (stats?.total_losses ?? 0))) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="bg-[#0D1320]">
        <CardHeader>
          <p className="text-sm font-medium text-accent">Admin Pick</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Set today’s pick</h1>
          <p className="mt-2 text-sm text-muted">
            Pick from upcoming fixtures. Only one Admin Pick per day.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted">Select prediction (next 7 days)</div>
              <select
                value={predictionId}
                onChange={(e) => {
                  setPredictionId(e.target.value);
                  const next = upcoming.find((p) => String(p.id) === e.target.value) ?? null;
                  setAnalysis(next?.admin_analysis ?? "");
                  setStars(next?.admin_stars ?? 4);
                }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                {upcoming.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {formatMatchTitle(p)} • {p.league ?? "—"} • {p.match_date ? new Date(p.match_date).toLocaleString() : "—"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-muted">Admin Analysis (min 50 chars)</div>
              <textarea
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                rows={7}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              />
              <div className="mt-1 text-xs text-white/50">{analysis.trim().length} / 50</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted">Star rating</div>
                <select
                  value={stars}
                  onChange={(e) => setStars(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-muted">Preview</div>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                  {selected ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-white">{formatMatchTitle(selected)}</div>
                      <div className="text-white/70">{selected.tip ?? "—"}</div>
                      <div className="text-white/50">Odds: {Number(selected.odds ?? 0).toFixed(2)} • Stars: {stars}</div>
                    </div>
                  ) : (
                    "Select a prediction"
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void publish()}
              disabled={saving}
              className="w-full rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="text-sm font-semibold">Admin Pick Stats</div>
            <div className="mt-1 text-xs text-muted">Auto-calculated from predictions table.</div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Total Picks</div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats?.total_picks ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Wins</div>
                <div className="mt-2 text-2xl font-semibold text-[#10B981]">{stats?.total_wins ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Losses</div>
                <div className="mt-2 text-2xl font-semibold text-[#EF4444]">{stats?.total_losses ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Win Rate</div>
                <div className="mt-2 text-2xl font-semibold text-white">{(Math.round(winRate * 10) / 10).toFixed(1)}%</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Current Streak</div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats?.current_streak ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Best Streak</div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats?.best_streak ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="text-sm font-semibold">Last 20 Admin Picks</div>
          </CardHeader>
          <CardContent>
            {last.length ? (
              <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {last.map((p) => (
                  <div key={String(p.id)} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{formatMatchTitle(p)}</div>
                      <div className="mt-1 text-xs text-white/50">
                        {p.tip ?? "—"} • @{Number(p.odds ?? 0).toFixed(2)} • {p.match_date ? new Date(p.match_date).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ResultBadge value={String(p.result ?? "pending")} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                No admin picks yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

