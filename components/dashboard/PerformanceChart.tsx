"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/utils/cn";

type Range = "7d" | "30d" | "all";

export function PerformanceChart({
  series,
}: {
  series: Array<{ date: string; balance: number }>;
}) {
  const [range, setRange] = useState<Range>("30d");

  const filtered = useMemo(() => {
    if (range === "all") return series;
    const days = range === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return series.filter((p) => p.date >= cutoffIso);
  }, [range, series]);

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Bankroll Balance
          </div>
          <div className="mt-1 text-sm text-muted">Balance over time</div>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                range === r
                  ? "border-accent/40 bg-accent-soft text-foreground"
                  : "border-border bg-background/20 text-muted hover:border-accent/30",
              )}
            >
              {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "All time"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "#0D1320",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                color: "#E2E8F0",
              }}
              labelStyle={{ color: "#94A3B8" }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
