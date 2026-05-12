"use client";

import { useEffect, useMemo, useState } from "react";

import { createClientComponentClient } from "@/lib/supabase-client";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/utils/cn";
import { UpgradeBanner } from "@/components/ui/UpgradeBanner";

import { PredictionCard, type Prediction } from "./PredictionCard";
import { AdminPickCard } from "./AdminPickCard";

type LeagueFilter =
  | "All Leagues"
  | "EPL"
  | "La Liga"
  | "Champions League"
  | "Serie A"
  | "Bundesliga"
  | "Ligue 1"
  | "Others";

type TypeFilter = "All" | "1X2" | "Over/Under" | "BTTS";
type TierFilter = "All" | "Free" | "Basic" | "Pro";

const leagueFilters: LeagueFilter[] = [
  "All Leagues",
  "EPL",
  "La Liga",
  "Champions League",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Others",
];

const typeFilters: TypeFilter[] = ["All", "1X2", "Over/Under", "BTTS"];
const tierFilters: TierFilter[] = ["All", "Free", "Basic", "Pro"];

function normalizeLeague(league?: string | null) {
  const v = (league ?? "").toLowerCase();
  if (v.includes("epl") || v.includes("premier")) return "EPL";
  if (v.includes("laliga") || v.includes("la liga")) return "La Liga";
  if (v.includes("ucl") || v.includes("champions")) return "Champions League";
  if (v.includes("serie a")) return "Serie A";
  if (v.includes("bundes")) return "Bundesliga";
  if (v.includes("ligue")) return "Ligue 1";
  return "Others";
}

function normalizeType(type?: string | null) {
  const v = (type ?? "").toLowerCase();
  if (v.includes("1x2")) return "1X2";
  if (v.includes("over") || v.includes("under")) return "Over/Under";
  if (v.includes("btts")) return "BTTS";
  return type ?? "—";
}

function normalizeTier(t?: string | null) {
  const v = (t ?? "").toLowerCase();
  if (v === "elite") return "elite";
  if (v === "pro") return "pro";
  if (v === "basic") return "basic";
  return "free";
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-5 w-56 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-white/10" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-6 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-6 w-20 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

export function PredictionsFeed() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const { userSubscription, isLoading: isUserLoading } = useUser();

  const viewerTier = normalizeTier(userSubscription?.tier);

  const [league, setLeague] = useState<LeagueFilter>("All Leagues");
  const [type, setType] = useState<TypeFilter>("All");
  const [tier, setTier] = useState<TierFilter>("All");

  const [rows, setRows] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [adminPick, setAdminPick] = useState<Prediction | null>(null);
  const [adminStats, setAdminStats] = useState<{
    total_wins: number;
    total_losses: number;
    accuracy: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load({ count }: { count: boolean }) {
      setIsLoading(true);
      setError(null);
      setLimitReached(false);

      const res = await fetch(`/api/predictions?count=${count ? "1" : "0"}`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });

      if (cancelled) return;

      if (res.ok) {
        const json = (await res.json()) as {
          predictions?: Prediction[];
          limitReached?: boolean;
          error?: string;
        };

        setRows(json.predictions ?? []);
        setLimitReached(Boolean(json.limitReached));
        setIsLoading(false);
        return;
      }

      if (res.status !== 401) {
        setRows([]);
        setError(`Request failed (${res.status})`);
        setIsLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from("predictions")
        .select(
          "id,league,home_team,away_team,match_date,prediction_type,risk_level,result,form_home,form_away,h2h_home_wins,h2h_draws,h2h_away_wins,is_admin_pick,tier_required",
        )
        .order("is_admin_pick", { ascending: false })
        .order("match_date", { ascending: true });

      if (cancelled) return;

      if (err) {
        setRows([]);
        setError(err.message);
        setIsLoading(false);
        return;
      }

      setRows((data as Prediction[]) ?? []);
      setIsLoading(false);
    }

    const channel = supabase
      .channel("predictions-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        () => void load({ count: false }),
      )
      .subscribe();

    void load({ count: true });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdmin() {
      const res = await fetch("/api/admin-pick", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        pick?: Prediction | null;
        stats?: {
          total_wins?: number;
          total_losses?: number;
        } | null;
      };
      if (cancelled) return;
      setAdminPick(json.pick ?? null);
      const wins = json.stats?.total_wins ?? 0;
      const losses = json.stats?.total_losses ?? 0;
      const denom = wins + losses;
      setAdminStats({
        total_wins: wins,
        total_losses: losses,
        accuracy: denom > 0 ? (wins / denom) * 100 : 0,
      });
    }

    void loadAdmin();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const items = rows.slice();

    const pinned = items.filter((p) => Boolean(p.is_admin_pick));
    const rest = items.filter((p) => !Boolean(p.is_admin_pick));

    const applyFilters = (p: Prediction) => {
      if (league !== "All Leagues" && normalizeLeague(p.league) !== league)
        return false;

      const pt = normalizeType(p.prediction_type as string);
      if (type !== "All" && pt !== type) return false;

      const required = normalizeTier(p.tier_required ?? null);
      if (tier !== "All") {
        const label = tier.toLowerCase();
        if (required !== label) return false;
      }

      return true;
    };

    const pinnedFiltered = pinned.filter(applyFilters);
    const restFiltered = rest.filter(applyFilters);

    return [...pinnedFiltered, ...restFiltered];
  }, [rows, league, type, tier]);

  const pinnedPick =
    adminPick ??
    filtered.find((p) => Boolean(p.is_admin_pick)) ??
    null;
  const gridRows = pinnedPick
    ? filtered.filter((p) => String(p.id) !== String(pinnedPick.id))
    : filtered;

  return (
    <div className="mt-8">
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {leagueFilters.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLeague(l)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    league === l
                      ? "border-accent/40 bg-accent-soft text-foreground"
                      : "border-border bg-background/20 text-muted hover:border-accent/30",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {typeFilters.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    type === t
                      ? "border-accent/40 bg-accent-soft text-foreground"
                      : "border-border bg-background/20 text-muted hover:border-accent/30",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {tierFilters.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    tier === t
                      ? "border-accent/40 bg-accent-soft text-foreground"
                      : "border-border bg-background/20 text-muted hover:border-accent/30",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <UpgradeBanner show={viewerTier === "free" && limitReached} />

      {pinnedPick ? (
        <AdminPickCard
          prediction={pinnedPick}
          viewerTier={viewerTier}
          stats={adminStats}
        />
      ) : null}

      {isLoading || isUserLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : gridRows.length ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {gridRows.map((p) => (
            <PredictionCard
              key={String(p.id)}
              prediction={p}
              viewerTier={viewerTier}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-card/70 p-6 text-center">
          <div className="text-sm font-medium text-foreground">
            No predictions yet
          </div>
          <div className="mt-2 text-sm text-muted">
            Add rows to the predictions table to see live updates here.
          </div>
          {error ? (
            <div className="mt-3 text-xs text-muted">Supabase: {error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
