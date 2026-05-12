"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Lock, Star } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { canSeeAdminAnalysis } from "@/lib/tier-access";
import { cn } from "@/utils/cn";

import type { Prediction } from "./PredictionCard";

type AdminPickStats = {
  total_wins: number;
  total_losses: number;
  accuracy: number;
};

type ViewerTier = "free" | "basic" | "pro" | "elite";

function formatTime(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function AdminPickCard({
  prediction,
  viewerTier,
  stats,
}: {
  prediction: Prediction;
  viewerTier: ViewerTier;
  stats?: AdminPickStats | null;
}) {
  const kickoff = useMemo(() => parseDate(prediction.match_date), [prediction.match_date]);
  const postedAt = useMemo(() => parseDate(prediction.created_at ?? null), [prediction.created_at]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const home = prediction.home_team || "Home";
  const away = prediction.away_team || "Away";
  const league = prediction.league || "Others";
  const tip = prediction.tip || "—";
  const odds = prediction.odds ?? "—";
  const risk = String(prediction.risk_level || "Medium");

  const starsRaw = prediction.admin_stars ?? prediction.admin_rating ?? 0;
  const stars = Math.max(0, Math.min(5, Number(starsRaw) || 0));

  const canSeeAnalysis = canSeeAdminAnalysis(viewerTier);
  const analysis = prediction.admin_analysis || "—";

  const deltaMs = kickoff ? kickoff.getTime() - now : null;
  const countdown =
    deltaMs === null
      ? "—"
      : deltaMs <= 0
        ? "Live"
        : `${Math.max(0, Math.floor(deltaMs / 60000))}m`;

  const wins = stats?.total_wins ?? prediction.admin_wins ?? 0;
  const losses = stats?.total_losses ?? prediction.admin_losses ?? 0;
  const denom = wins + losses;
  const accuracy = stats?.accuracy ?? (denom > 0 ? (wins / denom) * 100 : 0);

  return (
    <div className="mt-6">
      <div className="rounded-[20px] bg-[linear-gradient(135deg,#F59E0B,#FBBF24)] p-[1px]">
        <Card className="bg-card/90">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-4 py-1.5 text-xs font-semibold text-yellow-200">
                <Crown className="size-4" />
                👑 NADINHO&apos;S PICK — TODAY&apos;S FEATURED SELECTION
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-border bg-background/30 px-3 py-1">
                  {league}
                </span>
                <span className="rounded-full border border-border bg-background/30 px-3 py-1">
                  Odds {String(odds)}
                </span>
                <span className="rounded-full border border-border bg-background/30 px-3 py-1">
                  {risk} risk
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="text-lg font-semibold text-foreground">
                {home} <span className="text-muted">vs</span> {away}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span>
                  {kickoff ? `Kickoff ${formatTime(kickoff)}` : "Kickoff —"}
                </span>
                <span className="text-foreground">{countdown}</span>
                <span>
                  {postedAt ? `Posted ${formatTime(postedAt)} — before kick-off` : "Posted —"}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">Today&apos;s tip</div>
              <div className="mt-2 text-base font-semibold text-foreground">
                {tip}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-medium text-foreground">
                  Admin analysis
                </div>
                {canSeeAnalysis ? null : (
                  <span className="inline-flex items-center gap-2 text-xs text-muted">
                    <Lock className="size-4" />
                    Upgrade
                  </span>
                )}
              </div>
              <p className={cn("mt-2 text-sm text-muted", !canSeeAnalysis && "blur-[6px]")}>
                {canSeeAnalysis ? analysis : "Locked"}
              </p>
              {canSeeAnalysis ? null : (
                <div className="mt-4">
                  <ButtonLink href="/pricing" variant="primary" className="w-full">
                    Upgrade to see full analysis
                  </ButtonLink>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/20 p-4">
              <div className="flex items-center gap-1 text-yellow-200">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={`${prediction.id}-admin-star-${idx}`}
                    className={cn(
                      "size-4",
                      stars >= idx + 1 ? "fill-yellow-200" : "opacity-30",
                    )}
                  />
                ))}
              </div>

              <div className="text-xs text-muted">
                Admin Pick Record:{" "}
                <span className="font-medium text-foreground">{wins}W</span> /{" "}
                <span className="font-medium text-foreground">{losses}L</span> —{" "}
                <span className="font-medium text-foreground">
                  {Math.round(accuracy * 10) / 10}%
                </span>{" "}
                Accuracy
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
