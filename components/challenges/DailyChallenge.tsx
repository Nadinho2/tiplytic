"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type Option = "Home Win" | "Draw" | "Away Win";

type ApiResponse = {
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
    kickoffMs: number;
    odds: number | string | null;
  };
  status?: "open" | "locked" | "resolved";
  lockAtMs?: number | null;
  options: Option[];
  entry?: {
    tip: string;
    is_correct: boolean | null;
    points_earned: number | null;
    created_at: string | null;
  } | null;
  split?: Array<{ tip: Option; count: number; pct: number }>;
};

type WeeklyRow = { rank: number; userId: string; username: string; points: number };

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function pctBarWidth(pct: number) {
  const v = Math.max(0, Math.min(100, pct));
  return `${v}%`;
}

export function DailyChallenge({ className }: { className?: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState<Option | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<WeeklyRow[] | null>(null);
  const [recap, setRecap] = useState<WeeklyRow[] | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/daily-challenge", { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as ApiResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load challenge");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadWeekly() {
      try {
        const res = await fetch("/api/daily-challenge/weekly?week=current", { method: "GET" });
        if (!res.ok) return;
        const json = (await res.json()) as { rows?: WeeklyRow[] };
        if (!cancelled) setWeekly(json.rows ?? []);
      } catch {}
    }
    void loadWeekly();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const d = new Date();
    const isMonday = d.getDay() === 1;
    if (!isMonday) return;
    let cancelled = false;
    async function loadRecap() {
      try {
        const res = await fetch("/api/daily-challenge/weekly?week=prev", { method: "GET" });
        if (!res.ok) return;
        const json = (await res.json()) as { rows?: WeeklyRow[] };
        if (!cancelled) setRecap(json.rows ?? []);
      } catch {}
    }
    void loadRecap();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = data?.status ?? "open";
  const match = data?.match;
  const challenge = data?.challenge;

  const kickoffMs = match?.kickoffMs ?? null;
  const countdownMs = kickoffMs != null ? kickoffMs - now : null;
  const locked = status !== "open";
  const resolved = status === "resolved";

  const hasEntry = Boolean(data?.entry?.tip);
  const myTip = data?.entry?.tip ?? null;
  const myCorrect = data?.entry?.is_correct;
  const myPoints = data?.entry?.points_earned ?? 0;

  const split = useMemo(() => data?.split ?? [], [data?.split]);
  const top = useMemo(() => {
    if (!split.length) return null;
    return split.slice().sort((a, b) => b.pct - a.pct)[0] ?? null;
  }, [split]);

  async function submit(tip: Option) {
    setSubmitError(null);
    setSubmitting(tip);
    try {
      const res = await fetch("/api/daily-challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tip }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setSubmitError("Sign in to enter today’s challenge.");
          return;
        }
        setSubmitError(json.error || `Request failed (${res.status})`);
        return;
      }

      const refreshed = await fetch("/api/daily-challenge", { method: "GET" });
      if (refreshed.ok) {
        const j2 = (await refreshed.json()) as ApiResponse;
        setData(j2);
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge>Today&apos;s Challenge</Badge>
              {challenge ? (
                <span className="text-xs text-muted">{challenge.participants} entered</span>
              ) : null}
            </div>
            <div className="mt-3 text-base font-semibold text-foreground">
              {match ? (
                <>
                  {match.homeTeam ?? "Home"}{" "}
                  <span className="text-muted">vs</span>{" "}
                  {match.awayTeam ?? "Away"}
                </>
              ) : (
                "No challenge set yet"
              )}
            </div>
            {match?.league ? (
              <div className="mt-1 text-sm text-muted">{match.league}</div>
            ) : null}
          </div>

          <div className="text-right">
            <div className="text-xs text-muted">Kick-off</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {countdownMs == null ? "—" : countdownMs <= 0 ? "Live" : formatCountdown(countdownMs)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
            Loading…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : !challenge || !match ? (
          <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
            Challenge not available yet. Check back later.
          </div>
        ) : (
          <div className="space-y-4">
            {recap && recap.length ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-sm font-semibold text-foreground">Weekly recap</div>
                <div className="mt-1 text-sm text-muted">Top scorers from last week.</div>
                <div className="mt-3 space-y-2">
                  {recap.slice(0, 3).map((r) => (
                    <div key={r.userId} className="flex items-center justify-between text-sm">
                      <div className="text-foreground">
                        <span className="text-muted">#{r.rank}</span> @{r.username}
                      </div>
                      <div className="font-semibold text-foreground">{r.points} pts</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!locked ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {data?.options.map((o) => (
                    <Button
                      key={o}
                      type="button"
                      variant={myTip === o ? "primary" : "secondary"}
                      disabled={hasEntry || submitting != null}
                      onClick={() => submit(o)}
                    >
                      {submitting === o ? "…" : o}
                    </Button>
                  ))}
                </div>

                {hasEntry ? (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    You entered: <span className="font-semibold">{myTip}</span>
                  </div>
                ) : null}

                {submitError ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
                    {submitError}{" "}
                    {submitError.includes("Sign in") ? (
                      <ButtonLink href="/sign-in" variant="secondary" size="sm" className="ml-2">
                        Sign in
                      </ButtonLink>
                    ) : null}
                  </div>
                ) : null}

                <div className="text-xs text-muted">
                  Lock: 30 minutes before kick-off. Correct answers earn 10–30 points based on odds.
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-foreground">Community split</div>
                    {top ? (
                      <div className="text-xs text-muted">
                        {Math.round(top.pct)}% backs{" "}
                        <span className="font-semibold text-foreground">{top.tip}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {split.map((s, idx) => (
                      <div key={s.tip} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">{s.tip}</span>
                          <span className="text-muted">{Math.round(s.pct)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              idx === 0
                                ? "bg-accent"
                                : idx === 1
                                  ? "bg-emerald-500/70"
                                  : "bg-amber-400/70",
                            )}
                            style={{ width: pctBarWidth(s.pct) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {resolved ? (
                  <div className="rounded-2xl border border-border bg-background/20 p-4">
                    <div className="text-sm font-semibold text-foreground">Result</div>
                    <div className="mt-2 text-sm text-muted">
                      Correct answer:{" "}
                      <span className="font-semibold text-foreground">
                        {challenge.correctTip ?? "—"}
                      </span>
                      {" • "}
                      Winners:{" "}
                      <span className="font-semibold text-foreground">
                        {challenge.correctCount}
                      </span>
                    </div>

                    {hasEntry ? (
                      <div className="mt-3 text-sm">
                        Your pick:{" "}
                        <span className="font-semibold text-foreground">{myTip}</span>{" "}
                        {" • "}
                        <span
                          className={
                            myCorrect
                              ? "font-semibold text-emerald-300"
                              : myCorrect === false
                                ? "font-semibold text-red-300"
                                : "text-muted"
                          }
                        >
                          {myCorrect ? `Correct (+${myPoints} pts)` : myCorrect === false ? "Wrong" : "Pending"}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-muted">You didn’t enter today.</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted">
                    Locked. Results will appear after the match is settled.
                  </div>
                )}
              </>
            )}

            {weekly && weekly.length ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-foreground">Weekly leaderboard</div>
                  <div className="text-xs text-muted">Challenge points</div>
                </div>
                <div className="mt-3 space-y-2">
                  {weekly.slice(0, 5).map((r) => (
                    <div key={r.userId} className="flex items-center justify-between text-sm">
                      <div className="text-foreground">
                        <span className="text-muted">#{r.rank}</span> @{r.username}
                      </div>
                      <div className="font-semibold text-foreground">{r.points} pts</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
