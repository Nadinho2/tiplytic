"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type Period = "week" | "month" | "all";
type Sort = "win_rate" | "roi" | "total_picks" | "streak";

type LeaderboardRow = {
  userId: string;
  username: string;
  totalPicks: number;
  winRate: number;
  roi: number;
  streak: number;
  bestStreak: number;
  rank: string;
  rankLabel: string;
  rankColor: string;
};

type LeaderboardResponse = {
  totalTipsters: number;
  limited: boolean;
  featured: LeaderboardRow | null;
  rows: LeaderboardRow[];
};

type ChallengeResponse = {
  challenge: {
    id: string;
    matchId: string;
    challengeDate: string;
    correctTip: string | null;
    participants: number;
    correctCount: number;
  } | null;
  match?: {
    id: string;
    homeTeam: string | null;
    awayTeam: string | null;
    league: string | null;
    kickoffAt: string;
    odds: number | string | null;
  } | null;
  status?: "open" | "locked" | "resolved";
  options: string[];
  split?: Array<{ tip: string; count: number; pct: number }>;
};

type AdminPredictionsResponse = {
  rows: Array<{
    id: string | number;
    league?: string | null;
    home_team?: string | null;
    away_team?: string | null;
    match_date?: string | null;
    result?: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown) {
  if (!isRecord(value)) return null;
  const err = value.error;
  return typeof err === "string" && err.trim() ? err : null;
}

function normalizeTab(value: string) {
  if (value === "leaderboard") return "leaderboard";
  if (value === "challenge") return "challenge";
  if (value === "manual-picks") return "manual-picks";
  return "tipsters";
}

function formatPercent(v: number) {
  if (!Number.isFinite(v)) return "0.0%";
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function startOfUtcDayIso(d: Date) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  return dt.toISOString();
}

export function CommunityClient({ initialTab }: { initialTab: string }) {
  const tab = normalizeTab(initialTab);

  const [period, setPeriod] = useState<Period>("month");
  const [sort, setSort] = useState<Sort>("win_rate");
  const [lbLoading, setLbLoading] = useState(false);
  const [lbData, setLbData] = useState<LeaderboardResponse | null>(null);

  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matches, setMatches] = useState<AdminPredictionsResponse | null>(null);
  const [matchIdDraft, setMatchIdDraft] = useState("");
  const [correctTipDraft, setCorrectTipDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const [manualLoading, setManualLoading] = useState(false);
  const [manualData, setManualData] = useState<any>(null);
  const [manualResultFilter, setManualResultFilter] = useState("pending");

  useEffect(() => {
    if (tab !== "tipsters" && tab !== "leaderboard") return;
    let cancelled = false;
    async function load() {
      setLbLoading(true);
      const res = await fetch(`/api/tipsters/leaderboard?period=${period}&sort=${sort}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as LeaderboardResponse | { error?: string } | null;
      if (cancelled) return;
      if (!res || !res.ok || !json || "error" in json) {
        toast.error(getErrorMessage(json) || "Failed to load leaderboard");
        setLbData(null);
        setLbLoading(false);
        return;
      }
      setLbData(json as LeaderboardResponse);
      setLbLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [period, sort, tab]);

  useEffect(() => {
    if (tab !== "challenge") return;
    let cancelled = false;
    async function load() {
      setChallengeLoading(true);
      const res = await fetch("/api/daily-challenge", { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as ChallengeResponse | { error?: string } | null;
      if (cancelled) return;
      if (!res || !res.ok || !json) {
        toast.error(getErrorMessage(json) || "Failed to load daily challenge");
        setChallenge(null);
        setChallengeLoading(false);
        return;
      }
      setChallenge(json as ChallengeResponse);
      setCorrectTipDraft("");
      setChallengeLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "challenge") return;
    let cancelled = false;
    async function loadMatches() {
      setMatchesLoading(true);
      const now = new Date();
      const from = startOfUtcDayIso(now);
      const tomorrow = new Date(from);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const to = tomorrow.toISOString();
      const qs = new URLSearchParams({
        result: "pending",
        sort: "match_date",
        dir: "asc",
        from,
        to,
        page: "0",
      });
      const res = await fetch(`/api/admin/predictions?${qs.toString()}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as AdminPredictionsResponse | null;
      if (cancelled) return;
      if (!res || !res.ok || !json || json.error) {
        toast.error(json?.error || "Failed to load matches");
        setMatches(null);
        setMatchesLoading(false);
        return;
      }
      setMatches(json);
      setMatchesLoading(false);
    }
    void loadMatches();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "manual-picks") return;
    let cancelled = false;
    async function load() {
      setManualLoading(true);
      const res = await fetch(`/api/admin/community-predictions?result=${manualResultFilter}`, { method: "GET" }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (cancelled) return;
      if (!res || !res.ok || !json || json.error) {
        toast.error(json?.error || "Failed to load manual picks");
        setManualData(null);
      } else {
        setManualData(json);
      }
      setManualLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [tab, manualResultFilter]);

  async function settleManualPick(id: string | number, result: "win" | "loss" | "void") {
    const ok = window.confirm(`Resolve this manual pick as ${result.toUpperCase()}?`);
    if (!ok) return;

    const res = await fetch("/api/admin/community-predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ predictionId: id, result }),
    }).catch(() => null);

    const json = await res?.json().catch(() => null);
    if (!res || !res.ok) {
      toast.error(json?.error || "Failed to settle prediction");
      return;
    }
    toast.success("Prediction settled");
    
    const refreshRes = await fetch(`/api/admin/community-predictions?result=${manualResultFilter}`, { method: "GET" }).catch(() => null);
    if (refreshRes?.ok) {
      setManualData(await refreshRes.json());
    }
  }

  const periodTabs: Array<{ key: Period; label: string }> = useMemo(
    () => [
      { key: "week", label: "This Week" },
      { key: "month", label: "This Month" },
      { key: "all", label: "All Time" },
    ],
    [],
  );

  const sortOptions: Array<{ key: Sort; label: string }> = useMemo(
    () => [
      { key: "win_rate", label: "Win Rate" },
      { key: "roi", label: "ROI" },
      { key: "total_picks", label: "Total Picks" },
      { key: "streak", label: "Current Streak" },
    ],
    [],
  );

  async function setTodayChallenge() {
    if (!matchIdDraft.trim()) {
      toast.error("Select a match first");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/daily-challenge/admin/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId: matchIdDraft.trim() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSaving(false);
    if (!res || !res.ok || !json?.ok) {
      toast.error(json?.error || "Failed to set challenge");
      return;
    }
    toast.success("Daily challenge set");
    const refresh = await fetch("/api/daily-challenge", { method: "GET" }).catch(() => null);
    const refreshed = (await refresh?.json().catch(() => null)) as ChallengeResponse | null;
    if (refresh?.ok && refreshed) setChallenge(refreshed);
  }

  async function resolveTodayChallenge() {
    if (!correctTipDraft.trim()) {
      toast.error("Select the correct outcome");
      return;
    }
    const ok = window.confirm(`Resolve today’s challenge as "${correctTipDraft}"? This updates all entries.`);
    if (!ok) return;

    setSaving(true);
    const res = await fetch("/api/daily-challenge/admin/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ correctTip: correctTipDraft.trim() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSaving(false);
    if (!res || !res.ok || !json?.ok) {
      toast.error(json?.error || "Failed to resolve challenge");
      return;
    }
    toast.success("Challenge resolved");
    const refresh = await fetch("/api/daily-challenge", { method: "GET" }).catch(() => null);
    const refreshed = (await refresh?.json().catch(() => null)) as ChallengeResponse | null;
    if (refresh?.ok && refreshed) setChallenge(refreshed);
  }

  const matchOptions = useMemo(() => {
    const rows = matches?.rows ?? [];
    return rows
      .map((r) => {
        const id = String(r.id);
        const home = r.home_team || "—";
        const away = r.away_team || "—";
        const league = r.league || "—";
        const kickoff = formatDate(r.match_date ?? null);
        return { id, label: `${league} • ${home} vs ${away} • ${kickoff}` };
      });
  }, [matches?.rows]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Community</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tipsters & community</h1>
        <p className="mt-2 text-sm text-muted">Leaderboard, tipsters, and daily challenge controls.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/community?tab=tipsters"
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "tipsters" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Tipsters
        </Link>
        <Link
          href="/admin/community?tab=leaderboard"
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "leaderboard" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Leaderboard
        </Link>
        <Link
          href="/admin/community?tab=challenge"
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "challenge" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Daily Challenge
        </Link>
        <Link
          href="/admin/community?tab=manual-picks"
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "manual-picks" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Manual Picks
        </Link>
      </div>

      {tab === "challenge" ? (
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="text-sm font-semibold text-foreground">Daily challenge</div>
            <div className="mt-1 text-sm text-muted">Set today’s match and resolve outcomes.</div>
          </CardHeader>
          <CardContent>
            {challengeLoading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">Loading…</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-muted">Status</div>
                  <div className="mt-1 text-sm font-semibold text-white">{challenge?.status ?? "—"}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-white/60">Participants</div>
                      <div className="mt-1 text-lg font-semibold text-white">{challenge?.challenge?.participants ?? 0}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-white/60">Correct</div>
                      <div className="mt-1 text-lg font-semibold text-white">{challenge?.challenge?.correctCount ?? 0}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-white/60">Kickoff</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatDate(challenge?.match?.kickoffAt)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-muted">Current match</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {challenge?.match ? `${challenge.match.league ?? "—"} • ${challenge.match.homeTeam ?? "—"} vs ${challenge.match.awayTeam ?? "—"}` : "—"}
                  </div>
                  <div className="mt-1 text-xs text-white/60">Match ID: {challenge?.challenge?.matchId ?? "—"}</div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white">Set today’s match</div>
                    <div className="mt-2 text-xs text-white/60">Pick from today’s pending predictions.</div>
                    <div className="mt-3 flex gap-2">
                      <select
                        value={matchIdDraft}
                        onChange={(e) => setMatchIdDraft(e.target.value)}
                        disabled={matchesLoading || saving}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                      >
                        <option value="">Select match…</option>
                        {matchOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving || !matchIdDraft.trim()}
                        onClick={() => void setTodayChallenge()}
                        className="shrink-0 rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Set"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white">Resolve</div>
                    <div className="mt-2 text-xs text-white/60">Marks all entries and awards points.</div>
                    <div className="mt-3 flex gap-2">
                      <select
                        value={correctTipDraft}
                        onChange={(e) => setCorrectTipDraft(e.target.value)}
                        disabled={saving || (challenge?.status === "resolved")}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                      >
                        <option value="">Select outcome…</option>
                        {(challenge?.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving || !correctTipDraft.trim() || (challenge?.status === "resolved")}
                        onClick={() => void resolveTodayChallenge()}
                        className="shrink-0 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Resolve"}
                      </button>
                    </div>
                  </div>
                </div>

                {challenge?.split?.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white">Entry split</div>
                    <div className="mt-3 space-y-2">
                      {challenge.split.map((s) => (
                        <div key={s.tip} className="flex items-center justify-between gap-3 text-sm">
                          <div className="text-white">{s.tip}</div>
                          <div className="text-white/70">{s.count} • {formatPercent(s.pct)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : tab === "manual-picks" ? (
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Manual Predictions</div>
                <div className="mt-1 text-sm text-muted">Settle user-submitted manual/custom predictions.</div>
              </div>
              <div>
                <select
                  value={manualResultFilter}
                  onChange={(e) => setManualResultFilter(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="all">All</option>
                  <option value="win">Wins</option>
                  <option value="loss">Losses</option>
                  <option value="void">Voids</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {manualLoading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">Loading…</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-3">User & Match</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Tip</div>
                  <div className="col-span-1 text-right">Odds</div>
                  <div className="col-span-1 text-right">Stake</div>
                  <div className="col-span-3 text-right">Actions</div>
                </div>
                <div className="divide-y divide-border">
                  {(manualData?.rows ?? []).map((r: any) => (
                    <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                      <div className="col-span-3 min-w-0">
                        <div className="truncate font-medium text-foreground">{r.match_title || r.match || "—"}</div>
                        <div className="mt-1 text-xs text-muted">User: {r.user_id?.slice(0, 8)}...</div>
                      </div>
                      <div className="col-span-2 text-muted">{formatDate(r.match_date || r.created_at)}</div>
                      <div className="col-span-2 min-w-0">
                        <div className="truncate text-foreground">{r.tip}</div>
                        <div className="text-xs text-muted">{r.prediction_type}</div>
                      </div>
                      <div className="col-span-1 text-right text-foreground">{r.odds}</div>
                      <div className="col-span-1 text-right text-foreground">{r.stake || "—"}</div>
                      <div className="col-span-3 flex justify-end gap-2">
                        {r.result === "pending" ? (
                          <>
                            <button
                              onClick={() => void settleManualPick(r.id, "win")}
                              className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-1 text-xs font-semibold text-[#10B981] hover:bg-[#10B981]/20"
                            >
                              Win
                            </button>
                            <button
                              onClick={() => void settleManualPick(r.id, "loss")}
                              className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-2 py-1 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/20"
                            >
                              Loss
                            </button>
                            <button
                              onClick={() => void settleManualPick(r.id, "void")}
                              className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
                            >
                              Void
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold uppercase text-white/70">
                            {r.result}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!manualData?.rows?.length ? (
                    <div className="px-4 py-10 text-center text-sm text-muted">No manual predictions found.</div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">{tab === "leaderboard" ? "Leaderboard" : "Tipsters"}</div>
                <div className="mt-1 text-sm text-muted">Uses the same API as the public leaderboard.</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {periodTabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setPeriod(t.key)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        period === t.key
                          ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
                >
                  {sortOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {lbLoading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">Loading…</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Username</div>
                  <div className="col-span-2">Rank</div>
                  <div className="col-span-2 text-right">Picks</div>
                  <div className="col-span-2 text-right">Win Rate</div>
                  <div className="col-span-1 text-right">ROI</div>
                  <div className="col-span-1 text-right">Profile</div>
                </div>
                <div className="divide-y divide-border">
                  {(lbData?.rows ?? []).map((r, idx) => (
                    <div key={r.userId} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                      <div className="col-span-1 text-muted">{idx + 1}</div>
                      <div className="col-span-3 truncate text-foreground">@{r.username}</div>
                      <div className="col-span-2">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-white/80">
                          {r.rankLabel}
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-foreground">{r.totalPicks}</div>
                      <div className="col-span-2 text-right text-foreground">{formatPercent(r.winRate)}</div>
                      <div className="col-span-1 text-right text-foreground">{formatPercent(r.roi)}</div>
                      <div className="col-span-1 text-right">
                        <a
                          href={`/tipsters/${encodeURIComponent(r.username)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#3B82F6] hover:underline"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  ))}
                  {!lbData?.rows?.length ? (
                    <div className="px-4 py-10 text-center text-sm text-muted">No leaderboard data.</div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
