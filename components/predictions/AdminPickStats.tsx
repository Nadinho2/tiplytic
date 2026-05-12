"use client";

import { useEffect, useState } from "react";

import { cn } from "@/utils/cn";

type AdminPickStats = {
  total_picks: number;
  total_wins: number;
  total_losses: number;
  current_streak: number;
  best_streak: number;
};

type AdminPickResponse = {
  stats?: AdminPickStats | null;
  last5?: Array<"win" | "loss" | "void">;
};

function dotClass(r: string) {
  if (r === "win") return "bg-[#10B981]";
  if (r === "loss") return "bg-[#EF4444]";
  return "bg-white/30";
}

export function AdminPickStats({ className }: { className?: string }) {
  const [data, setData] = useState<AdminPickResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/admin-pick", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as AdminPickResponse;
      if (!cancelled) setData(json);
    }

    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const stats = data?.stats;
  const wins = stats?.total_wins ?? 0;
  const losses = stats?.total_losses ?? 0;
  const total = stats?.total_picks ?? wins + losses;
  const rate = total > 0 ? (wins / total) * 100 : 0;
  const last5 = data?.last5 ?? [];

  return (
    <div
      className={cn(
        "mt-6 rounded-2xl border border-border bg-card/60 p-4",
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-xs text-muted">Total admin picks</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {total}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Win rate</div>
          <div className="mt-2 text-2xl font-semibold text-[#10B981]">
            {Math.round(rate * 10) / 10}%
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Current streak</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {stats?.current_streak ?? 0}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Best streak</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {stats?.best_streak ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-xs text-muted">Last 5 results</div>
        <div className="flex items-center gap-2">
          {last5.length ? (
            last5.slice(0, 5).map((r, idx) => (
              <span
                key={`${r}-${idx}`}
                className={cn("size-2.5 rounded-full", dotClass(r))}
                title={r.toUpperCase()}
              />
            ))
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
