"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClientComponentClient } from "@/lib/supabase-client";
import { cn } from "@/utils/cn";

type PredictionType = "1X2" | "Over/Under" | "BTTS" | "Handicap";

type Fixture = {
  id: string | number;
  league?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_date?: string | null;
};

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
}

function formatKickoff(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function makeTitle(f: Fixture) {
  const home = f.home_team ?? "Home";
  const away = f.away_team ?? "Away";
  return `${home} vs ${away}`;
}

export function SubmitPredictionForm({ className }: { className?: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bankroll, setBankroll] = useState<number | null>(null);

  const [matchId, setMatchId] = useState<string>("");
  const [predictionType, setPredictionType] = useState<PredictionType>("1X2");
  const [tip, setTip] = useState("");
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [reasoning, setReasoning] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const now = new Date();
      const start = startOfUtcDay(now).toISOString();
      const end = endOfUtcDay(now).toISOString();

      const { data, error: err } = await supabase
        .from("predictions")
        .select("id,league,home_team,away_team,match_date")
        .gte("match_date", start)
        .lte("match_date", end)
        .order("match_date", { ascending: true })
        .limit(300);

      if (cancelled) return;
      if (err) {
        setFixtures([]);
        setIsLoading(false);
        setError(err.message);
        return;
      }

      setFixtures((data as Fixture[] | null) ?? []);
      setIsLoading(false);
    }

    async function loadBankroll() {
      try {
        const res = await fetch("/api/bankroll", { method: "GET" });
        if (!res.ok) return;
        const json = (await res.json()) as { currentBalance?: number };
        if (!cancelled) setBankroll(typeof json.currentBalance === "number" ? json.currentBalance : null);
      } catch {}
    }

    void load();
    void loadBankroll();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const oddsNumber = Number(odds);
  const oddsTooLow = Number.isFinite(oddsNumber) && oddsNumber > 0 && oddsNumber < 1.5;

  const maxStake =
    bankroll != null ? Math.max(0, Math.floor(bankroll * 0.2)) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);

    const trimmedTip = tip.trim();
    if (!matchId) {
      setError("Pick a match from today’s fixtures.");
      return;
    }
    if (!trimmedTip) {
      setError("Enter your tip.");
      return;
    }
    if (!Number.isFinite(oddsNumber) || oddsNumber < 1.5) {
      setError("Only predictions at odds 1.50+ count toward your rank");
      return;
    }
    if (reasoning.length > 200) {
      setError("Reasoning must be 200 characters or less.");
      return;
    }

    const stakeNumber = stake.trim() ? Math.floor(Number(stake)) : null;
    if (stakeNumber != null) {
      if (!Number.isFinite(stakeNumber) || stakeNumber <= 0) {
        setError("Stake must be a valid number.");
        return;
      }
      if (stakeNumber < 100) {
        setError("Stake must be at least ₦100.");
        return;
      }
      if (bankroll != null && stakeNumber > bankroll) {
        setError("Insufficient bankroll balance.");
        return;
      }
      if (maxStake != null && stakeNumber > maxStake) {
        setError(`Max stake is ₦${maxStake.toLocaleString()}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/community-predictions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchId,
          predictionType,
          tip: trimmedTip,
          odds: oddsNumber,
          stake: stakeNumber,
          reasoning: reasoning.trim() || null,
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }

      setOk("Prediction submitted.");
      setTip("");
      setOdds("");
      setStake("");
      setReasoning("");
      try {
        const r2 = await fetch("/api/bankroll", { method: "GET" });
        if (r2.ok) {
          const b = (await r2.json()) as { currentBalance?: number };
          setBankroll(typeof b.currentBalance === "number" ? b.currentBalance : bankroll);
        }
      } catch {}
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="text-sm font-semibold text-foreground">Submit a community prediction</div>
        <p className="mt-1 text-sm text-muted">
          Picks lock 30 minutes before kick-off. Max 10 per day.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">Match</div>
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
                disabled={isLoading}
              >
                <option value="">{isLoading ? "Loading…" : "Select today’s fixture"}</option>
                {fixtures.map((f) => (
                  <option key={String(f.id)} value={String(f.id)}>
                    {makeTitle(f)} • {formatKickoff(f.match_date)}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted">
                Match must be from today’s fixtures.
              </div>
            </label>

            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">Prediction Type</div>
              <select
                value={predictionType}
                onChange={(e) => setPredictionType(e.target.value as PredictionType)}
                className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
              >
                <option value="1X2">1X2</option>
                <option value="Over/Under">Over-Under</option>
                <option value="BTTS">BTTS</option>
                <option value="Handicap">Handicap</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">Tip</div>
              <input
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                placeholder='e.g. "Over 2.5", "Home Win", "BTTS Yes"'
                className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">Odds</div>
              <input
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                inputMode="decimal"
                placeholder="1.80"
                className={cn(
                  "h-11 w-full rounded-xl border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted",
                  oddsTooLow ? "border-amber-500/50" : "border-border",
                )}
              />
              {oddsTooLow ? (
                <div className="text-xs text-amber-400">
                  Only predictions at odds 1.50+ count toward your rank
                </div>
              ) : null}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">Stake (optional)</div>
              <input
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                inputMode="numeric"
                placeholder="₦0"
                className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
              />
              <div className="text-xs text-muted">
                Available:{" "}
                {bankroll == null
                  ? "—"
                  : new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "NGN",
                      maximumFractionDigits: 0,
                    }).format(bankroll)}{" "}
                {maxStake != null ? `• Max stake: ₦${maxStake.toLocaleString()}` : null}
              </div>
            </label>

            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">
                Reasoning (optional)
              </div>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value.slice(0, 200))}
                placeholder="Why this pick?"
                className="min-h-[44px] w-full rounded-xl border border-border bg-background/30 px-3 py-2 text-sm text-foreground placeholder:text-muted"
              />
              <div className="text-xs text-muted">{reasoning.length}/200</div>
            </label>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {ok ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {ok}
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit prediction"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
