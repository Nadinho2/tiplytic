"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClientComponentClient } from "@/lib/supabase-client";
import { cn } from "@/utils/cn";

type PredictionType = "1X2" | "Over/Under" | "BTTS" | "Handicap";
type MatchMode = "today" | "manual";

type Fixture = {
  id: string | number;
  league?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_date?: string | null;
};

type BookmakerRow = {
  name: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  over25: number | null;
  under25: number | null;
};

type OddsResponse = {
  success?: boolean;
  available?: boolean;
  cached?: boolean;
  home_odds?: number | null;
  draw_odds?: number | null;
  away_odds?: number | null;
  over25_odds?: number | null;
  under25_odds?: number | null;
  btts_yes_odds?: number | null;
  btts_no_odds?: number | null;
  best_odds_by_tip?: Record<string, number>;
  bookmakers?: BookmakerRow[];
  fetched_at?: string;
  message?: string;
  manual_input_allowed?: boolean;
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

function tipOptionsFor(type: PredictionType) {
  if (type === "1X2") return ["Home Win", "Draw", "Away Win"] as const;
  if (type === "BTTS") return ["BTTS Yes", "BTTS No"] as const;
  if (type === "Over/Under") {
    return ["Over 1.5", "Under 1.5", "Over 2.5", "Under 2.5", "Over 3.5", "Under 3.5"] as const;
  }
  return [] as const;
}

function getOddsForTip(tip: string, oddsData: OddsResponse | null): number | null {
  if (!oddsData?.best_odds_by_tip) return null;
  return oddsData.best_odds_by_tip[tip] ?? null;
}

function getBookmakerOddsForTip(tip: string, bookmakers: BookmakerRow[]): { name: string; odds: number }[] {
  const results: { name: string; odds: number }[] = [];
  for (const bm of bookmakers) {
    let val: number | null = null;
    if (tip === "Home Win") val = bm.home;
    else if (tip === "Draw") val = bm.draw;
    else if (tip === "Away Win") val = bm.away;
    else if (tip === "Over 2.5") val = bm.over25;
    else if (tip === "Under 2.5") val = bm.under25;
    if (val != null) results.push({ name: bm.name, odds: val });
  }
  return results.sort((a, b) => b.odds - a.odds);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function SubmitPredictionForm({ className }: { className?: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bankroll, setBankroll] = useState<number | null>(null);

  const [matchMode, setMatchMode] = useState<MatchMode>("today");
  const [matchId, setMatchId] = useState<string>("");
  const [manualLeague, setManualLeague] = useState("");
  const [manualHome, setManualHome] = useState("");
  const [manualAway, setManualAway] = useState("");
  const [manualKickoff, setManualKickoff] = useState("");

  const [predictionType, setPredictionType] = useState<PredictionType>("1X2");
  const [tip, setTip] = useState("");
  const [tipIsCustom, setTipIsCustom] = useState(false);
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [reasoning, setReasoning] = useState("");

  // Odds state
  const [oddsData, setOddsData] = useState<OddsResponse | null>(null);
  const [oddsFetching, setOddsFetching] = useState(false);
  const [oddsVerified, setOddsVerified] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load fixtures and bankroll
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

  // Set default tip when prediction type changes
  useEffect(() => {
    const options = tipOptionsFor(predictionType);
    if (!options.length) {
      setTipIsCustom(true);
      return;
    }
    setTipIsCustom(false);
    setTip(options[0] ?? "");
  }, [predictionType]);

  // Fetch odds when match is selected
  const fetchOdds = useCallback(async (id: string) => {
    if (!id) {
      setOddsData(null);
      setOddsVerified(false);
      return;
    }
    setOddsFetching(true);
    try {
      const res = await fetch(`/api/odds?match_id=${encodeURIComponent(id)}`);
      const json = (await res.json()) as OddsResponse;
      setOddsData(json);
      setOddsVerified(json.available === true);
    } catch {
      setOddsData(null);
      setOddsVerified(false);
    } finally {
      setOddsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (matchMode === "today" && matchId) {
      void fetchOdds(matchId);
    } else {
      setOddsData(null);
      setOddsVerified(false);
    }
  }, [matchId, matchMode, fetchOdds]);

  // Auto-update odds when tip changes and we have verified odds
  useEffect(() => {
    if (!oddsVerified || !oddsData) return;
    const matched = getOddsForTip(tip, oddsData);
    if (matched != null) {
      setOdds(matched.toFixed(2));
    }
  }, [tip, oddsData, oddsVerified]);

  // Auto-refresh stale odds (> 3 hours)
  useEffect(() => {
    if (!oddsData?.fetched_at || !matchId || matchMode !== "today") return;
    const age = Date.now() - new Date(oddsData.fetched_at).getTime();
    if (age > 3 * 60 * 60 * 1000) {
      void fetchOdds(matchId);
    }
  }, [oddsData?.fetched_at, matchId, matchMode, fetchOdds]);

  const oddsNumber = Number(odds);
  const oddsTooLow = Number.isFinite(oddsNumber) && oddsNumber > 0 && oddsNumber < 1.5;
  const maxStake = bankroll != null ? Math.max(0, Math.floor(bankroll * 0.2)) : null;

  // Bookmaker breakdown for current tip
  const bmBreakdown = oddsVerified && oddsData?.bookmakers
    ? getBookmakerOddsForTip(tip, oddsData.bookmakers).slice(0, 5)
    : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);

    const trimmedTip = tip.trim();
    if (matchMode === "today") {
      if (!matchId) {
        setError("Pick a match from today's fixtures or switch to Manual fixture.");
        return;
      }
    } else {
      const home = manualHome.trim();
      const away = manualAway.trim();
      if (!home || !away) {
        setError("Enter home and away teams.");
        return;
      }
      if (!manualKickoff.trim()) {
        setError("Pick a kickoff date/time.");
        return;
      }
      const kickoff = new Date(manualKickoff);
      if (Number.isNaN(kickoff.getTime())) {
        setError("Kickoff date/time is invalid.");
        return;
      }
      const deltaMs = kickoff.getTime() - Date.now();
      if (deltaMs <= 0) {
        setError("Kickoff must be in the future.");
        return;
      }
      if (deltaMs <= 30 * 60 * 1000) {
        setError("Predictions lock 30 minutes before kick-off.");
        return;
      }
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
      const manualPayload =
        matchMode === "manual"
          ? {
              matchTitle: `${manualHome.trim()} vs ${manualAway.trim()}`,
              league: manualLeague.trim() || null,
              matchDate: new Date(manualKickoff).toISOString(),
            }
          : null;

      const res = await fetch("/api/community-predictions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchId: matchMode === "today" ? matchId : null,
          predictionType,
          tip: trimmedTip,
          odds: oddsNumber,
          stake: stakeNumber,
          reasoning: reasoning.trim() || null,
          odds_verified: oddsVerified,
          odds_source: oddsVerified ? "the-odds-api" : "manual",
          ...manualPayload,
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
      setTipIsCustom(false);
      setOdds("");
      setStake("");
      setReasoning("");
      setManualLeague("");
      setManualHome("");
      setManualAway("");
      setManualKickoff("");
      setMatchId("");
      setOddsData(null);
      setOddsVerified(false);
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
          {/* Match mode toggle */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMatchMode("today")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                matchMode === "today"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-background/20 text-muted hover:bg-background/30",
              )}
            >
              Today&apos;s fixture
            </button>
            <button
              type="button"
              onClick={() => setMatchMode("manual")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                matchMode === "manual"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-background/20 text-muted hover:bg-background/30",
              )}
            >
              Manual fixture
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {matchMode === "today" ? (
              <label className="space-y-2">
                <div className="text-xs font-medium text-foreground">Match</div>
                <select
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
                  disabled={isLoading}
                >
                  <option value="">{isLoading ? "Loading…" : "Select today's fixture"}</option>
                  {fixtures.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>
                      {makeTitle(f)} • {formatKickoff(f.match_date)}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted">Uses today&apos;s fixtures list.</div>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <div className="text-xs font-medium text-foreground">Home Team</div>
                    <input
                      value={manualHome}
                      onChange={(e) => setManualHome(e.target.value)}
                      placeholder="Home team"
                      className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                    />
                  </label>
                  <label className="space-y-2">
                    <div className="text-xs font-medium text-foreground">Away Team</div>
                    <input
                      value={manualAway}
                      onChange={(e) => setManualAway(e.target.value)}
                      placeholder="Away team"
                      className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <div className="text-xs font-medium text-foreground">League (optional)</div>
                    <input
                      value={manualLeague}
                      onChange={(e) => setManualLeague(e.target.value)}
                      placeholder="e.g. EPL"
                      className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                    />
                  </label>
                  <label className="space-y-2">
                    <div className="text-xs font-medium text-foreground">Kickoff</div>
                    <input
                      value={manualKickoff}
                      onChange={(e) => setManualKickoff(e.target.value)}
                      type="datetime-local"
                      className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
                    />
                  </label>
                </div>
              </div>
            )}

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

          {/* Tip + Odds */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-medium text-foreground">Tip</div>
              {tipOptionsFor(predictionType).length ? (
                <div className="space-y-2">
                  <select
                    value={tipIsCustom ? "__custom__" : tip}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__custom__") {
                        setTipIsCustom(true);
                        setTip("");
                      } else {
                        setTipIsCustom(false);
                        setTip(v);
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
                  >
                    {tipOptionsFor(predictionType).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {tipIsCustom ? (
                    <input
                      value={tip}
                      onChange={(e) => setTip(e.target.value)}
                      placeholder='e.g. "Over 2.5", "Home Win", "BTTS Yes"'
                      className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                    />
                  ) : null}
                </div>
              ) : (
                <input
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  placeholder='e.g. "Over 2.5", "Home Win", "BTTS Yes"'
                  className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                />
              )}
            </label>

            {/* Odds section — verified or manual */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-foreground">Odds</div>
                {oddsFetching && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                    Fetching live odds…
                  </span>
                )}
                {!oddsFetching && oddsVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    ✓ Verified
                  </span>
                )}
                {!oddsFetching && matchMode === "today" && matchId && !oddsVerified && oddsData && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    ⚠ Unverified
                  </span>
                )}
                {!oddsFetching && oddsVerified && matchId && (
                  <button
                    type="button"
                    onClick={() => void fetchOdds(matchId)}
                    className="ml-auto text-xs text-blue-400 hover:text-blue-300"
                  >
                    ↻ Refresh
                  </button>
                )}
              </div>

              {oddsVerified ? (
                <>
                  <input
                    value={odds}
                    readOnly
                    className="h-11 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 text-sm font-semibold text-emerald-300 cursor-not-allowed"
                  />
                  {bmBreakdown.length > 0 && (
                    <div className="rounded-lg border border-border bg-background/20 p-2">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                        Bookmaker breakdown
                      </div>
                      <div className="space-y-0.5">
                        {bmBreakdown.map((bm) => (
                          <div key={bm.name} className="flex items-center justify-between text-xs">
                            <span className="text-muted">{bm.name}</span>
                            <span className="font-semibold text-foreground">{bm.odds.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
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
                  {matchMode === "today" && matchId && !oddsFetching && oddsData && !oddsData.available && (
                    <div className="text-xs text-amber-400">
                      Odds not available for this match. Enter odds from your bookmaker.
                    </div>
                  )}
                </>
              )}
              {oddsTooLow ? (
                <div className="text-xs text-amber-400">
                  Only predictions at odds 1.50+ count toward your rank
                </div>
              ) : null}
              {oddsData?.fetched_at && oddsVerified && (
                <div className="text-[10px] text-muted">
                  Odds updated: {timeAgo(oddsData.fetched_at)}
                  {oddsData.cached && " (cached)"}
                </div>
              )}
            </div>
          </div>

          {/* Stake + Reasoning */}
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
