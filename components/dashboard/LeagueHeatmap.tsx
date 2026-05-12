"use client";

import { cn } from "@/utils/cn";

export function LeagueHeatmap({
  rows,
}: {
  rows: Array<{ league: string; winRate: number; wins: number; losses: number; total: number }>;
}) {
  function barColor(winRate: number) {
    if (winRate >= 60) return "bg-[#10B981]";
    if (winRate >= 45) return "bg-yellow-400";
    return "bg-[#EF4444]";
  }

  function recommendation(winRate: number) {
    if (winRate >= 60) return "Strong";
    if (winRate >= 45) return "Average";
    return "Avoid";
  }

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="text-sm font-semibold text-foreground">
        League Performance
      </div>
      <div className="mt-1 text-sm text-muted">
        Win rate by league with quick recommendations.
      </div>

      <div className="mt-5 space-y-4">
        {rows.length ? (
          rows.map((r) => (
            <div key={r.league} className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{r.league}</div>
                  <div className="mt-1 text-xs text-muted">
                    {r.wins}W / {r.losses}L ({r.total} decided)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {Math.round(r.winRate * 10) / 10}%
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {recommendation(r.winRate)}
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full", barColor(r.winRate))}
                  style={{ width: `${Math.max(0, Math.min(100, r.winRate))}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border bg-background/20 p-6 text-center text-sm text-muted">
            No league data yet.
          </div>
        )}
      </div>
    </div>
  );
}
