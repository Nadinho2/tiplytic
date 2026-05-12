"use client";

import { cn } from "@/utils/cn";
import type { StreakStats } from "@/lib/stats-engine";

export function StreakBadge({ streak }: { streak: StreakStats }) {
  const isWin = streak.type === "win" && streak.current > 0;
  const isLoss = streak.type === "loss" && streak.current < 0;
  const count = Math.abs(streak.current);
  const label = isWin
    ? `🔥 ${count} win streak`
    : isLoss
      ? `🧊 ${count} loss streak`
      : "—";

  const animated = streak.type !== "none" && count >= 5;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background/20 p-4",
        animated
          ? "bg-[linear-gradient(120deg,rgba(59,130,246,0.18),rgba(16,185,129,0.14),rgba(59,130,246,0.18))] bg-[length:200%_200%] [animation:streakShift_2.2s_ease-in-out_infinite]"
          : undefined,
      )}
    >
      <div className="text-xs text-muted">Current Streak</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{label}</div>
      <div className="mt-1 text-xs text-muted">
        Best streak: {streak.longest} wins
      </div>
    </div>
  );
}
