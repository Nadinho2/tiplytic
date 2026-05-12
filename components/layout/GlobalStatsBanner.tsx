"use client";

import { useEffect, useMemo, useState } from "react";

import { createClientComponentClient } from "@/lib/supabase-client";
import { cn } from "@/utils/cn";

type Stats = {
  totalPredictions: number;
  winRate: number;
  streakLabel: string;
  activeSubscribers: number;
  communityTipsters: number;
};

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 10) / 10}%`;
}

export function GlobalStatsBanner({ className }: { className?: string }) {
  const [stats, setStats] = useState<Stats>({
    totalPredictions: 0,
    winRate: 0,
    streakLabel: "—",
    activeSubscribers: 0,
    communityTipsters: 0,
  });

  const supabase = useMemo(() => createClientComponentClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const next: Stats = {
        totalPredictions: 0,
        winRate: 0,
        streakLabel: "—",
        activeSubscribers: 0,
        communityTipsters: 0,
      };

      try {
        const { data } = await supabase.rpc("get_global_stats");
        const json = data as
          | {
              total_predictions?: number;
              win_rate?: number;
              active_subscribers?: number;
              community_tipsters?: number;
            }
          | null;
        next.totalPredictions = Number(json?.total_predictions ?? 0);
        next.winRate = Number(json?.win_rate ?? 0);
        next.activeSubscribers = Number(json?.active_subscribers ?? 0);
        next.communityTipsters = Number(json?.community_tipsters ?? 0);
      } catch {}

      try {
        if (next.totalPredictions === 0) {
          const { count: wins } = await supabase
            .from("predictions")
            .select("*", { count: "exact", head: true })
            .eq("result", "win");
          const { count: losses } = await supabase
            .from("predictions")
            .select("*", { count: "exact", head: true })
            .eq("result", "loss");
          const denom = (wins ?? 0) + (losses ?? 0);
          next.winRate = denom > 0 ? ((wins ?? 0) / denom) * 100 : 0;
          next.totalPredictions = denom;
        }
      } catch {}

      try {
        const { data } = await supabase
          .from("predictions")
          .select("result, created_at")
          .order("created_at", { ascending: false })
          .limit(20);

        if (data && data.length) {
          const first = data[0]?.result;
          if (first === "win" || first === "loss") {
            let streak = 0;
            for (const row of data) {
              if (row.result !== first) break;
              streak += 1;
            }
            next.streakLabel = `${streak} ${first === "win" ? "W" : "L"}`;
          }
        }
      } catch {}

      try {
        if (next.activeSubscribers === 0) {
          try {
            const { count } = await supabase
              .from("subscriptions")
              .select("*", { count: "exact", head: true })
              .eq("status", "active");
            next.activeSubscribers = count ?? 0;
          } catch {}

          if (next.activeSubscribers === 0) {
            const { count } = await supabase
              .from("user_subscriptions")
              .select("*", { count: "exact", head: true })
              .neq("tier", "free");
            next.activeSubscribers = count ?? 0;
          }
        }
      } catch {}

      if (!cancelled) setStats(next);
    }

    const interval = setInterval(() => {
      void refresh();
    }, 60_000);

    void refresh();

    const channel = supabase
      .channel("global-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_subscriptions" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_predictions" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const content = `Total Predictions: ${stats.totalPredictions} | Win Rate: ${formatPercent(
    stats.winRate,
  )} | Current Streak: ${stats.streakLabel} | Active Subscribers: ${
    stats.activeSubscribers
  } | Community Tipsters: ${stats.communityTipsters}`;

  return (
    <div className={cn("border-b border-border bg-background/50", className)}>
      <div className="marquee py-2 text-xs text-muted">
        <div className="marquee__track">
          <div className="mx-6">{content}</div>
          <div className="mx-6">{content}</div>
        </div>
      </div>
    </div>
  );
}
