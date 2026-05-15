"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { cn } from "@/utils/cn";

type Prediction = {
  id: string | number;
  league?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_date?: string | null;
  prediction_type?: string | null;
  tip?: string | null;
  odds?: number | string | null;
};

type Selection = { prediction_id: string; tip: string; odds: number };

type AccaRow = {
  id: string;
  selections: Selection[];
  combined_odds: number | null;
  stake: number | null;
  potential_return: number | null;
  result: string | null;
  created_at: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKickoff(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function matchTitle(p: Prediction) {
  const home = p.home_team ?? "Home";
  const away = p.away_team ?? "Away";
  return `${home} vs ${away}`;
}

function parseOdds(v: number | string | null | undefined) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function makeCustomId() {
  try {
    return `custom:${crypto.randomUUID()}`;
  } catch {
    return `custom:${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export default function Page() {
  const [tab, setTab] = useState<"builder" | "history">("builder");

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predLoading, setPredLoading] = useState(true);
  const [predError, setPredError] = useState<string | null>(null);

  const [bankroll, setBankroll] = useState<number | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [stake, setStake] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placedId, setPlacedId] = useState<string | null>(null);

  const [manualHome, setManualHome] = useState("");
  const [manualAway, setManualAway] = useState("");
  const [manualTip, setManualTip] = useState("");
  const [manualOdds, setManualOdds] = useState("");
  const [manualLeague, setManualLeague] = useState("");

  const [history, setHistory] = useState<AccaRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPredictions() {
      setPredLoading(true);
      setPredError(null);
      try {
        const res = await fetch("/api/predictions?count=0", { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as { predictions?: Prediction[]; error?: string };
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        const rows = (json.predictions ?? []).filter((p) => isToday(p.match_date));
        if (!cancelled) setPredictions(rows);
      } catch (e) {
        if (!cancelled) setPredError(e instanceof Error ? e.message : "Failed to load predictions");
      } finally {
        if (!cancelled) setPredLoading(false);
      }
    }

    async function loadBankroll() {
      try {
        const res = await fetch("/api/bankroll", { method: "GET" });
        if (!res.ok) return;
        const json = (await res.json()) as { currentBalance?: number };
        if (!cancelled) setBankroll(typeof json.currentBalance === "number" ? json.currentBalance : null);
      } catch {}
    }

    void loadPredictions();
    void loadBankroll();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch("/api/accumulators", { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as { rows?: AccaRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        if (!cancelled) setHistory(json.rows ?? []);
      } catch (e) {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const combinedOdds = useMemo(() => {
    if (!selections.length) return 0;
    return round2(selections.reduce((acc, s) => acc * s.odds, 1));
  }, [selections]);

  const hasManual = useMemo(
    () => selections.some((s) => String(s.prediction_id).startsWith("custom:")),
    [selections],
  );

  const stakeNumber = Math.floor(Number(stake));
  const potentialReturn = useMemo(() => {
    if (!selections.length) return 0;
    if (!Number.isFinite(stakeNumber) || stakeNumber <= 0) return 0;
    return round2(stakeNumber * combinedOdds);
  }, [combinedOdds, selections.length, stakeNumber]);

  const maxStake =
    bankroll != null ? Math.max(0, Math.floor(bankroll * 0.2)) : null;

  function addToAcca(p: Prediction) {
    setPlacedId(null);
    setPlaceError(null);
    if (selections.length >= 10) {
      setPlaceError("Max 10 selections per accumulator");
      return;
    }

    const odds = parseOdds(p.odds);
    if (odds == null || odds <= 1) return;

    const id = String(p.id);
    if (selections.some((s) => s.prediction_id === id)) return;

    const label = `${matchTitle(p)} • ${p.tip ?? "—"}`;
    setSelections((prev) => [...prev, { prediction_id: id, tip: label, odds }]);
  }

  function addManualSelection() {
    setPlacedId(null);
    setPlaceError(null);
    if (selections.length >= 10) {
      setPlaceError("Max 10 selections per accumulator");
      return;
    }

    const home = manualHome.trim();
    const away = manualAway.trim();
    const tip = manualTip.trim();
    const odds = Number(manualOdds);
    if (!home || !away) {
      setPlaceError("Enter home and away teams for the manual leg.");
      return;
    }
    if (!tip) {
      setPlaceError("Enter a prediction/tip for the manual leg.");
      return;
    }
    if (!Number.isFinite(odds) || odds <= 1) {
      setPlaceError("Manual odds must be greater than 1.00.");
      return;
    }

    const league = manualLeague.trim();
    const label = `${league ? `${league} • ` : ""}${home} vs ${away} • ${tip}`;
    if (selections.some((s) => s.tip === label)) return;

    setSelections((prev) => [...prev, { prediction_id: makeCustomId(), tip: label, odds: round2(odds) }]);
    setManualHome("");
    setManualAway("");
    setManualTip("");
    setManualOdds("");
    setManualLeague("");
  }

  function removeSelection(id: string) {
    setSelections((prev) => prev.filter((s) => s.prediction_id !== id));
  }

  async function place() {
    setPlacedId(null);
    setPlaceError(null);

    if (!selections.length) {
      setPlaceError("Add at least one selection");
      return;
    }
    if (!hasManual) {
      if (!Number.isFinite(stakeNumber) || stakeNumber < 100) {
        setPlaceError("Stake must be at least ₦100");
        return;
      }
      if (maxStake != null && stakeNumber > maxStake) {
        setPlaceError(`Max stake is ₦${maxStake.toLocaleString()}.`);
        return;
      }
      if (bankroll != null && stakeNumber > bankroll) {
        setPlaceError("Insufficient bankroll balance");
        return;
      }
    }

    setPlacing(true);
    try {
      const res = await fetch("/api/accumulators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selections,
          stake: hasManual ? 0 : stakeNumber,
          mode: hasManual ? "draft" : "bankroll",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        accumulator?: { id?: string };
        nextBalance?: number;
      };
      if (!res.ok) {
        setPlaceError(json.error || `Request failed (${res.status})`);
        return;
      }

      const id = String(json.accumulator?.id ?? "");
      setPlacedId(id || null);
      setSelections([]);
      setStake("");
      if (typeof json.nextBalance === "number") setBankroll(json.nextBalance);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Container className="py-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Accumulator</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Accumulator Builder
          </h1>
          <p className="mt-3 text-sm text-muted">
            Build multi-match slips and place them on your virtual bankroll.
          </p>
        </div>
        <Badge>{tab === "builder" ? "Builder" : "History"}</Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("builder")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            tab === "builder"
              ? "border-accent/40 bg-accent-soft text-foreground"
              : "border-border bg-background/20 text-muted hover:border-accent/30",
          )}
        >
          Builder
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            tab === "history"
              ? "border-accent/40 bg-accent-soft text-foreground"
              : "border-border bg-background/20 text-muted hover:border-accent/30",
          )}
        >
          Previous Accumulators
        </button>
      </div>

      {tab === "history" ? (
        <Card className="mt-6">
          <CardHeader>
            <div className="text-sm font-semibold text-foreground">History</div>
            <p className="mt-1 text-sm text-muted">
              Past accumulators placed on your virtual bankroll.
            </p>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
                Loading…
              </div>
            ) : historyError ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200">
                {historyError}
              </div>
            ) : history.length ? (
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-4">Date</div>
                  <div className="col-span-2 text-right">Selections</div>
                  <div className="col-span-2 text-right">Odds</div>
                  <div className="col-span-2 text-right">Stake</div>
                  <div className="col-span-1 text-right">Result</div>
                  <div className="col-span-1 text-right">Share</div>
                </div>
                <div className="divide-y divide-border bg-card/40">
                  {history.map((h) => {
                    const d = h.created_at ? new Date(h.created_at) : null;
                    const label = d && !Number.isNaN(d.getTime())
                      ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—";
                    const r = String(h.result ?? "pending").toLowerCase();
                    return (
                      <div key={h.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
                        <div className="col-span-4 text-muted">{label}</div>
                        <div className="col-span-2 text-right text-muted">
                          {Array.isArray(h.selections) ? h.selections.length : 0}
                        </div>
                        <div className="col-span-2 text-right text-muted">
                          {Number(h.combined_odds ?? 0).toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right text-muted">
                          {h.stake != null ? formatMoney(Number(h.stake)) : "—"}
                        </div>
                        <div className="col-span-1 text-right">
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium",
                              r === "win"
                                ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
                                : r === "loss"
                                  ? "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
                                  : r === "void"
                                    ? "border-white/10 bg-white/[0.03] text-muted"
                                    : "border-white/10 bg-white/[0.03] text-muted",
                            )}
                          >
                            {String(h.result ?? "pending").toUpperCase()}
                          </span>
                        </div>
                        <div className="col-span-1 text-right">
                          <Link
                            href={`/accumulators/${encodeURIComponent(h.id)}`}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
                No accumulators yet.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="text-sm font-semibold text-foreground">Today’s predictions</div>
              <p className="mt-1 text-sm text-muted">Add up to 10 selections.</p>
            </CardHeader>
            <CardContent>
              {predLoading ? (
                <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
                  Loading…
                </div>
              ) : predError ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200">
                  {predError}
                </div>
              ) : predictions.length ? (
                <div className="space-y-3">
                  {predictions.map((p) => {
                    const id = String(p.id);
                    const already = selections.some((s) => s.prediction_id === id);
                    const odds = parseOdds(p.odds);
                    return (
                      <div
                        key={id}
                        className="flex flex-col gap-3 rounded-2xl border border-border bg-background/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {matchTitle(p)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span>{p.league ?? "Others"}</span>
                            <span className="text-muted-2">•</span>
                            <span>Kickoff {formatKickoff(p.match_date)}</span>
                            <span className="text-muted-2">•</span>
                            <span>{p.prediction_type ?? "—"}</span>
                          </div>
                          <div className="mt-2 text-sm text-muted">
                            Tip: <span className="font-medium text-foreground">{p.tip ?? "—"}</span>{" "}
                            <span className="text-muted-2">•</span> Odds{" "}
                            <span className="font-medium text-foreground">
                              {odds != null ? odds.toFixed(2) : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => addToAcca(p)}
                            disabled={already || odds == null}
                          >
                            {already ? "Added" : "Add to Acca"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
                  No predictions found for today.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold text-foreground">Accumulator slip</div>
              <p className="mt-1 text-sm text-muted">
                Available bankroll: {bankroll == null ? "—" : formatMoney(bankroll)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-xs font-semibold text-foreground">Add manual leg</div>
                  <div className="mt-2 grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        value={manualHome}
                        onChange={(e) => setManualHome(e.target.value)}
                        placeholder="Home team"
                        className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                      />
                      <input
                        value={manualAway}
                        onChange={(e) => setManualAway(e.target.value)}
                        placeholder="Away team"
                        className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                      />
                    </div>
                    <input
                      value={manualLeague}
                      onChange={(e) => setManualLeague(e.target.value)}
                      placeholder="League (optional)"
                      className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        value={manualTip}
                        onChange={(e) => setManualTip(e.target.value)}
                        placeholder="Tip (e.g. Over 2.5, BTTS Yes)"
                        className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                      />
                      <input
                        value={manualOdds}
                        onChange={(e) => setManualOdds(e.target.value)}
                        inputMode="decimal"
                        placeholder="Odds (e.g. 1.85)"
                        className="h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={addManualSelection}>
                      Add manual leg
                    </Button>
                    <div className="text-xs text-muted">
                      Manual legs can be saved as a slip. Virtual bankroll placing works only for TipLytic picks.
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selections.length ? (
                    selections.map((s) => (
                      <div
                        key={s.prediction_id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/20 p-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {s.tip}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            Odds {s.odds.toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSelection(s.prediction_id)}
                          className="grid size-8 place-items-center rounded-lg border border-border bg-background/30 text-muted hover:text-foreground"
                          aria-label="Remove selection"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
                      Add picks from the left panel to start.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Combined odds</span>
                    <span className="font-semibold text-foreground">
                      {selections.length ? combinedOdds.toFixed(2) : "—"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-medium text-foreground">
                      What if I stake ₦X?
                    </div>
                    <input
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      inputMode="numeric"
                      placeholder="1000"
                      className="mt-2 h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground placeholder:text-muted"
                    />
                    <div className="mt-2 text-xs text-muted">
                      Potential return:{" "}
                      <span className="font-semibold text-foreground">
                        {potentialReturn > 0 ? formatMoney(potentialReturn) : "—"}
                      </span>
                      {maxStake != null ? ` • Max stake: ₦${maxStake.toLocaleString()}` : null}
                    </div>
                  </div>

                  {placeError ? (
                    <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {placeError}
                    </div>
                  ) : null}

                  {placedId ? (
                    <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                      {hasManual ? "Saved." : "Placed."}{" "}
                      <Link
                        href={`/accumulators/${encodeURIComponent(placedId)}`}
                        className="font-semibold underline"
                      >
                        Share slip
                      </Link>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full"
                      onClick={place}
                      disabled={placing || !selections.length}
                    >
                      {placing ? "Working…" : hasManual ? "Save slip" : "Place on Virtual Bankroll"}
                    </Button>
                    <div className="mt-2 text-xs text-muted">
                      {hasManual
                        ? "Saved slips don’t affect your bankroll and don’t auto-settle."
                        : "Max 10 selections. Accumulator wins only if all selections win. Voids are removed."}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Container>
  );
}
