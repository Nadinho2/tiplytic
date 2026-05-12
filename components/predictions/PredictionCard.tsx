"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Lock, Star, X } from "lucide-react";

import { useAuth } from "@clerk/nextjs";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { canSeeAdminAnalysis, canSeeConfidenceScore } from "@/lib/tier-access";
import { cn } from "@/utils/cn";

export type PredictionResult = "pending" | "win" | "loss" | "void";
export type PredictionType = "1X2" | "Over/Under" | "BTTS" | "Handicap";
export type RiskLevel = "Low" | "Medium" | "High";

export type Prediction = {
  id: string | number;
  league?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_date?: string | null;
  created_at?: string | null;
  prediction_type?: PredictionType | string | null;
  tip?: string | null;
  odds?: number | string | null;
  confidence?: number | null;
  risk_level?: RiskLevel | string | null;
  result?: PredictionResult | string | null;
  form_home?: string | string[] | null;
  form_away?: string | string[] | null;
  h2h_home_wins?: number | null;
  h2h_draws?: number | null;
  h2h_away_wins?: number | null;
  is_admin_pick?: boolean | null;
  admin_analysis?: string | null;
  admin_stars?: number | null;
  admin_rating?: number | null;
  admin_wins?: number | null;
  admin_losses?: number | null;
  admin_void?: number | null;
  tier_required?: "free" | "basic" | "pro" | "elite" | null;
};

type ViewerTier = "free" | "basic" | "pro" | "elite";

function getLeagueBadgeClasses(league: string) {
  const normalized = league.toLowerCase();
  if (normalized.includes("epl") || normalized.includes("premier")) {
    return "border-purple-500/25 bg-purple-500/10 text-purple-300";
  }
  if (normalized.includes("laliga") || normalized.includes("la liga")) {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  }
  if (normalized.includes("ucl") || normalized.includes("champions")) {
    return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  }
  if (normalized.includes("serie a")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (normalized.includes("bundes")) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (normalized.includes("ligue")) {
    return "border-sky-500/25 bg-sky-500/10 text-sky-300";
  }
  return "border-white/10 bg-white/[0.03] text-muted";
}

function getRiskClasses(risk: string) {
  const normalized = risk.toLowerCase();
  if (normalized === "low") return "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]";
  if (normalized === "medium") return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  return "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]";
}

function getResultClasses(result: string) {
  const normalized = result.toLowerCase();
  if (normalized === "win") return "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]";
  if (normalized === "loss") return "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]";
  if (normalized === "void") return "border-white/10 bg-white/[0.03] text-muted";
  return "border-white/10 bg-white/[0.03] text-muted";
}

function parseForm(value: Prediction["form_home"]) {
  if (!value) return [];
  if (Array.isArray(value)) return value.slice(0, 5);
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.includes(",")) return trimmed.split(",").map((s) => s.trim()).slice(0, 5);
  return trimmed.split("").slice(0, 5);
}

function getFormDotClasses(letter: string) {
  const v = letter.toUpperCase();
  if (v === "W") return "bg-[#10B981]";
  if (v === "D") return "bg-yellow-400";
  return "bg-[#EF4444]";
}

function formatKickoff(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function shouldBlurTip(viewerTier: ViewerTier) {
  return viewerTier === "free";
}

function shouldBlurConfidence(viewerTier: ViewerTier) {
  return !canSeeConfidenceScore(viewerTier);
}

export function PredictionCard({
  prediction,
  viewerTier,
}: {
  prediction: Prediction;
  viewerTier: ViewerTier;
}) {
  const { userId } = useAuth();
  const kickoff = useMemo(() => {
    const raw = prediction.match_date;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [prediction.match_date]);

  const [now, setNow] = useState(() => Date.now());
  const [stakeOpen, setStakeOpen] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("");
  const [bankrollBalance, setBankrollBalance] = useState<number | null>(null);
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [stakeLoading, setStakeLoading] = useState(false);
  const [consensus, setConsensus] = useState<{
    totalPredictors: number;
    breakdown: Array<{ tip: string; pct: number }>;
    topTip: string | null;
    topPct: number;
    favourite: boolean;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadConsensus() {
      try {
        const res = await fetch(
          `/api/community-predictions?matchId=${encodeURIComponent(String(prediction.id))}`,
          { method: "GET", signal: controller.signal },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          totalPredictors?: number;
          breakdown?: Array<{ tip: string; pct: number }>;
          topTip?: string | null;
          topPct?: number;
          favourite?: boolean;
        };
        if (cancelled) return;
        setConsensus({
          totalPredictors: Number(json.totalPredictors ?? 0),
          breakdown: Array.isArray(json.breakdown) ? json.breakdown : [],
          topTip: json.topTip ?? null,
          topPct: Number(json.topPct ?? 0),
          favourite: Boolean(json.favourite),
        });
      } catch {}
    }

    void loadConsensus();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [prediction.id]);

  const home = prediction.home_team || "Home";
  const away = prediction.away_team || "Away";
  const league = prediction.league || "Others";

  const tip = prediction.tip || "—";
  const odds = prediction.odds ?? "—";
  const oddsNumber = Number(odds);
  const confidence = Math.max(0, Math.min(100, prediction.confidence ?? 0));
  const risk = prediction.risk_level || "Medium";
  const result = prediction.result || "pending";

  const isAdminPick = Boolean(prediction.is_admin_pick);
  const showAdminVip = isAdminPick && viewerTier === "elite";
  const showAdminAnalysis = isAdminPick && canSeeAdminAnalysis(viewerTier);

  const deltaMs = kickoff ? kickoff.getTime() - now : null;
  const isLive = deltaMs !== null && deltaMs <= 0 && deltaMs > -2 * 60 * 60 * 1000;
  const countdownLabel =
    deltaMs === null ? "—" : isLive ? "Live" : formatCountdown(deltaMs);

  const homeForm = parseForm(prediction.form_home);
  const awayForm = parseForm(prediction.form_away);

  const h2hText =
    prediction.h2h_home_wins != null &&
    prediction.h2h_draws != null &&
    prediction.h2h_away_wins != null
      ? `H2H: ${prediction.h2h_home_wins}W-${prediction.h2h_draws}D-${prediction.h2h_away_wins}L`
      : "H2H: —";

  const tipBlur = shouldBlurTip(viewerTier);
  const confBlur = shouldBlurConfidence(viewerTier);

  const featuredBorder = isAdminPick
    ? "border-yellow-400/25 shadow-[0_0_0_1px_rgba(250,204,21,0.25),0_0_28px_rgba(250,204,21,0.12)]"
    : undefined;

  const maxStake =
    bankrollBalance != null ? Math.max(0, Math.floor(bankrollBalance * 0.2)) : null;

  const stakeValue = Math.floor(Number(stakeAmount));
  const potentialReturn =
    Number.isFinite(oddsNumber) && oddsNumber > 0 && Number.isFinite(stakeValue)
      ? stakeValue * oddsNumber
      : 0;

  async function openStake() {
    setStakeError(null);
    setStakeAmount("");
    setStakeOpen(true);
    try {
      const res = await fetch("/api/bankroll", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as { currentBalance?: number };
      setBankrollBalance(typeof json.currentBalance === "number" ? json.currentBalance : null);
    } catch {}
  }

  async function submitStake() {
    setStakeError(null);
    if (!userId) {
      setStakeError("Sign in to stake.");
      return;
    }
    if (!Number.isFinite(stakeValue) || stakeValue < 100) {
      setStakeError("Minimum stake is ₦100.");
      return;
    }
    if (bankrollBalance == null) {
      setStakeError("Unable to load bankroll.");
      return;
    }
    const max = Math.floor(bankrollBalance * 0.2);
    if (stakeValue > max) {
      setStakeError(`Max stake is ₦${max.toLocaleString()}.`);
      return;
    }
    if (stakeValue > bankrollBalance) {
      setStakeError("Insufficient balance.");
      return;
    }
    if (!Number.isFinite(oddsNumber) || oddsNumber <= 1) {
      setStakeError("Invalid odds for staking.");
      return;
    }

    setStakeLoading(true);
    try {
      const res = await fetch("/api/bankroll/stake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          predictionId: prediction.id,
          match: `${home} vs ${away}`,
          tip,
          odds: oddsNumber,
          stake: stakeValue,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string; currentBalance?: number };
      if (!res.ok) {
        setStakeError(json.error ?? `Stake failed (${res.status}).`);
        return;
      }

      if (typeof json.currentBalance === "number") setBankrollBalance(json.currentBalance);
      setStakeOpen(false);
    } finally {
      setStakeLoading(false);
    }
  }

  return (
    <Card className={cn("relative overflow-hidden bg-card/80", featuredBorder)}>
      {isAdminPick ? (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-300/70 to-transparent" />
      ) : null}

      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                  getLeagueBadgeClasses(league),
                )}
              >
                {league}
              </span>

              {isAdminPick ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                  <Star className="size-4" />
                  FEATURED PICK
                </span>
              ) : null}

              {showAdminVip ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                  <Crown className="size-4" />
                  VIP
                </span>
              ) : null}

              {String(result).toLowerCase() !== "pending" ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                    getResultClasses(String(result)),
                  )}
                >
                  {String(result).toUpperCase()}
                </span>
              ) : null}
            </div>

            <div className="mt-3 text-sm font-semibold text-foreground sm:text-base">
              {home} <span className="text-muted">vs</span> {away}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                {kickoff ? formatKickoff(kickoff) : "Kickoff: —"}
              </span>
              <span className={cn(isLive ? "text-[#10B981]" : "text-muted")}>
                {countdownLabel}
              </span>
              <span className="text-muted">{h2hText}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                getRiskClasses(String(risk)),
              )}
            >
              {String(risk)}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-background/30 px-3 py-1 text-xs font-medium text-foreground">
              Odds {String(odds)}
            </span>
            {userId ? (
              <Button type="button" variant="secondary" size="sm" onClick={openStake}>
                Stake
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl border border-border bg-background/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-muted">Type</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {prediction.prediction_type || "—"}
                </div>
              </div>
              <div className="min-w-0 text-right">
                <div className="text-xs text-muted">Tip</div>
                <div
                  className={cn(
                    "mt-1 text-sm font-semibold text-foreground",
                    tipBlur && "blur-[6px]",
                  )}
                >
                  {tip}
                </div>
              </div>
            </div>

            {tipBlur ? (
              <div className="mt-4">
                <ButtonLink href="/pricing" variant="primary" className="w-full">
                  Upgrade to Basic
                </ButtonLink>
              </div>
            ) : null}

            {consensus && consensus.totalPredictors >= 5 && consensus.topTip ? (
              <div className="mt-4 rounded-xl border border-border bg-background/20 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-muted">
                    {Math.round(consensus.topPct)}% of community backs{" "}
                    <span className="font-medium text-foreground">
                      {consensus.topTip}
                    </span>
                  </div>
                  {consensus.favourite ? (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      Community Favourite
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="flex h-full w-full">
                    {consensus.breakdown.slice(0, 4).map((b, idx) => (
                      <div
                        key={b.tip}
                        className={cn(
                          "h-full",
                          idx === 0
                            ? "bg-accent"
                            : idx === 1
                              ? "bg-emerald-500/70"
                              : idx === 2
                                ? "bg-amber-400/70"
                                : "bg-purple-500/70",
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, b.pct))}%` }}
                        title={`${b.tip}: ${Math.round(b.pct)}%`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-background/20 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">Confidence</div>
              {confBlur ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted">
                  <Lock className="size-4" />
                  Pro/Elite
                </span>
              ) : (
                <span className="text-xs font-medium text-foreground">
                  {confidence}%
                </span>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full bg-accent transition-all",
                  confBlur && "blur-[6px]",
                )}
                style={{ width: `${confidence}%` }}
              />
            </div>
            {viewerTier === "basic" ? (
              <div className="mt-3">
                <ButtonLink href="/pricing" variant="secondary" className="w-full">
                  Upgrade to Pro
                </ButtonLink>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-background/20 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted">{home} form</div>
                <div className="mt-2 flex items-center gap-2">
                  {homeForm.length ? (
                    homeForm.map((v, idx) => (
                      <span
                        key={`${prediction.id}-hf-${idx}`}
                        className={cn(
                          "size-2.5 rounded-full",
                          getFormDotClasses(String(v)),
                        )}
                        title={String(v).toUpperCase()}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">{away} form</div>
                <div className="mt-2 flex items-center gap-2">
                  {awayForm.length ? (
                    awayForm.map((v, idx) => (
                      <span
                        key={`${prediction.id}-af-${idx}`}
                        className={cn(
                          "size-2.5 rounded-full",
                          getFormDotClasses(String(v)),
                        )}
                        title={String(v).toUpperCase()}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isAdminPick ? (
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-medium text-yellow-200">
                  Admin analysis
                </div>
                {showAdminAnalysis ? null : (
                  <span className="inline-flex items-center gap-2 text-xs text-muted">
                    <Lock className="size-4" />
                    Basic+
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "mt-2 text-sm text-foreground",
                  showAdminAnalysis ? undefined : "blur-[6px]",
                )}
              >
                {showAdminAnalysis ? prediction.admin_analysis || "—" : "Locked"}
              </div>
              {showAdminAnalysis ? null : (
                <div className="mt-4">
                  <ButtonLink href="/pricing" variant="secondary" className="w-full">
                    Upgrade to Basic
                  </ButtonLink>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 text-yellow-200">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={`${prediction.id}-star-${idx}`}
                      className={cn(
                        "size-4",
                        (prediction.admin_rating ?? 0) >= idx + 1
                          ? "fill-yellow-200"
                          : "opacity-30",
                      )}
                    />
                  ))}
                </div>
                <div className="text-xs text-muted">
                  Admin Picks Record:{" "}
                  {prediction.admin_wins != null &&
                  prediction.admin_losses != null &&
                  prediction.admin_void != null
                    ? `${prediction.admin_wins}W-${prediction.admin_losses}L-${prediction.admin_void}V`
                    : "—"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>

      {stakeOpen ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background/70 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Stake on this pick
                </div>
                <div className="mt-1 text-sm text-muted">
                  Min ₦100 • Max 20% of balance
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStakeOpen(false)}
                className="grid size-9 place-items-center rounded-xl border border-border bg-background/20 text-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-sm font-medium text-foreground">
                {home} vs {away}
              </div>
              <div className="mt-1 text-sm text-muted">
                {tip} • Odds {String(odds)}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-muted">Stake amount</label>
              <input
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                inputMode="numeric"
                placeholder="1000"
                className="mt-2 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-accent/40"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>
                  Balance:{" "}
                  {bankrollBalance == null ? "—" : `₦${bankrollBalance.toLocaleString()}`}
                </span>
                <span>
                  Max:{" "}
                  {maxStake == null ? "—" : `₦${maxStake.toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Potential return</span>
                <span className="font-semibold text-foreground">
                  ₦{Math.floor(potentialReturn).toLocaleString()}
                </span>
              </div>
            </div>

            {stakeError ? (
              <div className="mt-3 text-sm text-[#EF4444]">{stakeError}</div>
            ) : null}

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStakeOpen(false)}
                disabled={stakeLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={submitStake}
                disabled={stakeLoading}
              >
                Confirm stake
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
