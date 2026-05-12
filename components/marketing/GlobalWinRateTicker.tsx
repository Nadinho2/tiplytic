"use client";

import { useEffect, useMemo, useState } from "react";

import { createClientComponentClient } from "@/lib/supabase-client";
import { cn } from "@/utils/cn";

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

export function GlobalWinRateTicker({ className }: { className?: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [winRate, setWinRate] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const { data } = await supabase.rpc("get_global_stats");
        const next = Number((data as { win_rate?: number } | null)?.win_rate ?? 0);
        if (!cancelled) setWinRate(Number.isFinite(next) ? next : 0);
        return;
      } catch {}

      try {
        const { count: wins } = await supabase
          .from("predictions")
          .select("*", { count: "exact", head: true })
          .eq("result", "win");
        const { count: losses } = await supabase
          .from("predictions")
          .select("*", { count: "exact", head: true })
          .eq("result", "loss");
        const denom = (wins ?? 0) + (losses ?? 0);
        const next = denom > 0 ? ((wins ?? 0) / denom) * 100 : 0;
        if (!cancelled) setWinRate(next);
      } catch {}
    }

    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);

    const channel = supabase
      .channel("global-win-rate")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm",
        className,
      )}
    >
      <span className="text-muted">Platform win rate:</span>{" "}
      <span className="font-semibold text-[#10B981]">{formatPercent(winRate)}</span>
      <span className="text-muted"> • updates live</span>
    </div>
  );
}

