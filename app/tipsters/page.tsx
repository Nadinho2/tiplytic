"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/utils/cn";

type Period = "week" | "month" | "all";
type Sort = "win_rate" | "roi" | "total_picks" | "streak";

type Row = {
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

type ApiResponse = {
  totalTipsters: number;
  limited: boolean;
  featured: Row | null;
  rows: Row[];
};

const periodTabs: Array<{ key: Period; label: string }> = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

const sortOptions: Array<{ key: Sort; label: string }> = [
  { key: "win_rate", label: "Win Rate" },
  { key: "roi", label: "ROI" },
  { key: "total_picks", label: "Total Picks" },
  { key: "streak", label: "Current Streak" },
];

function formatPercent(v: number) {
  if (!Number.isFinite(v)) return "0.0%";
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

export default function Page() {
  const { isFree, isLoading } = useUser();
  const [period, setPeriod] = useState<Period>("month");
  const [sort, setSort] = useState<Sort>("win_rate");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/tipsters/leaderboard?period=${period}&sort=${sort}`,
          { method: "GET", signal: controller.signal },
        );
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `Request failed (${res.status})`);
        }
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isLoading, period, sort]);

  const rows = data?.rows;
  const totalTipsters = data?.totalTipsters ?? 0;

  const locked = isFree;
  const visible = locked ? (rows?.slice(0, 10) ?? []) : (rows ?? []);

  const placeholders = useMemo(() => {
    if (!locked) return [];
    const count = Math.max(0, Math.min(15, Math.max(0, totalTipsters - visible.length)));
    return Array.from({ length: count }).map((_, idx) => idx);
  }, [locked, totalTipsters, visible.length]);

  return (
    <Container className="py-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Community Tipsters</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Leaderboard
          </h1>
          <p className="mt-3 text-sm text-muted">
            {totalTipsters ? `${totalTipsters} tipsters ranked` : "Ranked by performance and sample size."}
          </p>
        </div>
        <Badge>{locked ? "Free" : "Full access"}</Badge>
      </div>

      <div className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {periodTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPeriod(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  period === t.key
                    ? "border-accent/40 bg-accent-soft text-foreground"
                    : "border-border bg-background/20 text-muted hover:border-accent/30",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-muted">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
            >
              {sortOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {data?.featured ? (
          <Card className="mt-6 overflow-hidden border border-accent/25 bg-gradient-to-br from-accent-soft/60 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-accent">
                    Community Tipster of the Month
                  </div>
                  <div className="mt-2 text-lg font-semibold text-foreground">
                    @{data.featured.username}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {data.featured.totalPicks} picks • {formatPercent(data.featured.winRate)} win rate •{" "}
                    {formatPercent(data.featured.roi)} ROI
                  </div>
                </div>
                <ButtonLink
                  href={`/tipsters/${encodeURIComponent(data.featured.username)}`}
                  variant="primary"
                  size="sm"
                >
                  View profile
                </ButtonLink>
              </div>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-base font-semibold">Top tipsters</h2>
            <p className="mt-1 text-sm text-muted">
              Only predictions at odds 1.50+ count toward ranks and leaderboard stats.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
                Loading leaderboard…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200">
                {error}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Username</div>
                  <div className="col-span-2">Rank</div>
                  <div className="col-span-1 text-right">Picks</div>
                  <div className="col-span-2 text-right">Win Rate</div>
                  <div className="col-span-1 text-right">ROI</div>
                  <div className="col-span-1 text-right">Streak</div>
                  <div className="col-span-1 text-right">Profile</div>
                </div>

                <div className="divide-y divide-border bg-card/40">
                  {visible.map((r, idx) => {
                    const position = idx + 1;
                    const topBg =
                      position === 1
                        ? "bg-yellow-400/5"
                        : position === 2
                          ? "bg-slate-200/5"
                          : position === 3
                            ? "bg-orange-500/5"
                            : undefined;
                    const streakLabel =
                      r.streak === 0 ? "—" : r.streak > 0 ? `${r.streak}W` : `${Math.abs(r.streak)}L`;

                    return (
                      <div
                        key={r.userId}
                        className={cn("grid grid-cols-12 items-center px-4 py-3 text-sm", topBg)}
                      >
                        <div className="col-span-1 text-muted">{position}</div>
                        <div className="col-span-3 font-medium text-foreground">@{r.username}</div>
                        <div className="col-span-2">
                          <span
                            className="inline-flex items-center rounded-full border border-border bg-background/30 px-3 py-1 text-xs font-medium text-foreground"
                            style={{
                              borderColor: `${r.rankColor}55`,
                              backgroundColor: `${r.rankColor}1A`,
                            }}
                          >
                            {r.rankLabel}
                          </span>
                        </div>
                        <div className="col-span-1 text-right text-muted">{r.totalPicks}</div>
                        <div className="col-span-2 text-right font-medium text-muted">
                          {formatPercent(r.winRate)}
                        </div>
                        <div className="col-span-1 text-right font-medium text-accent">
                          {formatPercent(r.roi)}
                        </div>
                        <div className="col-span-1 text-right text-muted">{streakLabel}</div>
                        <div className="col-span-1 text-right">
                          <Link
                            href={`/tipsters/${encodeURIComponent(r.username)}`}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {placeholders.map((idx) => (
                    <div
                      key={`locked-${idx}`}
                      className="grid grid-cols-12 items-center px-4 py-3 text-sm opacity-40 blur-[3px]"
                    >
                      <div className="col-span-1 text-muted">—</div>
                      <div className="col-span-3 font-medium text-foreground">@locked</div>
                      <div className="col-span-2">
                        <span className="inline-flex items-center rounded-full border border-border bg-background/30 px-3 py-1 text-xs font-medium text-foreground">
                          —
                        </span>
                      </div>
                      <div className="col-span-1 text-right text-muted">—</div>
                      <div className="col-span-2 text-right text-muted">—</div>
                      <div className="col-span-1 text-right text-muted">—</div>
                      <div className="col-span-1 text-right text-muted">—</div>
                      <div className="col-span-1 text-right text-muted">—</div>
                    </div>
                  ))}
                </div>

                {locked ? (
                  <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/80 p-4 backdrop-blur">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="text-sm text-foreground">
                        Upgrade to Basic to see the full board.
                      </div>
                      <ButtonLink href="/pricing" variant="primary" size="sm">
                        Upgrade
                      </ButtonLink>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
