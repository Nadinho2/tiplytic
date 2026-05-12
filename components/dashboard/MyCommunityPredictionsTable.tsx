"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/utils/cn";

type Row = {
  id: string | number;
  created_at?: string | null;
  match_title?: string | null;
  match?: string | null;
  tip?: string | null;
  odds?: number | string | null;
  result?: string | null;
  profit_loss?: number | null;
  reasoning?: string | null;
  stake?: number | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MyCommunityPredictionsTable({ className }: { className?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => rows.slice(0, 200), [rows]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/community-predictions?mine=1", { method: "GET" });
      if (cancelled) return;

      if (!res.ok) {
        setRows([]);
        setError(`Request failed (${res.status})`);
        setLoading(false);
        return;
      }

      const json = (await res.json()) as { rows?: Row[]; error?: string };
      setRows(json.rows ?? []);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted", className)}>
        Loading your predictions…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200", className)}>
        {error}
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className={cn("rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted", className)}>
        No community predictions yet.
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border", className)}>
      <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
        <div className="col-span-4">Match</div>
        <div className="col-span-2">Tip</div>
        <div className="col-span-1 text-right">Odds</div>
        <div className="col-span-1 text-right">Stake</div>
        <div className="col-span-1 text-right">P&amp;L</div>
        <div className="col-span-1 text-right">Result</div>
        <div className="col-span-2">Reasoning</div>
      </div>

      <div className="divide-y divide-border bg-card/40">
        {visible.map((r) => {
          const match = r.match_title ?? r.match ?? "—";
          const res = String(r.result ?? "pending").toLowerCase();
          const pl = r.profit_loss ?? 0;
          return (
            <div key={String(r.id)} className="grid grid-cols-12 gap-y-2 px-4 py-3 text-sm">
              <div className="col-span-12 sm:col-span-4">
                <div className="font-medium text-foreground">{match}</div>
                <div className="mt-1 text-xs text-muted">{formatDate(r.created_at)}</div>
              </div>
              <div className="col-span-6 sm:col-span-2 text-muted">{r.tip ?? "—"}</div>
              <div className="col-span-2 text-right text-muted sm:col-span-1">{String(r.odds ?? "—")}</div>
              <div className="col-span-2 text-right text-muted sm:col-span-1">
                {typeof r.stake === "number" ? formatMoney(r.stake) : "—"}
              </div>
              <div className={cn("col-span-2 text-right font-semibold sm:col-span-1", pl >= 0 ? "text-[#10B981]" : "text-[#EF4444]")}>
                {formatMoney(pl)}
              </div>
              <div className="col-span-2 flex justify-end sm:col-span-1">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    res === "win"
                      ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
                      : res === "loss"
                        ? "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
                        : "border-white/10 bg-white/[0.03] text-muted",
                  )}
                >
                  {String(r.result ?? "pending").toUpperCase()}
                </span>
              </div>
              <div className="col-span-12 text-xs text-muted sm:col-span-2">
                {r.reasoning ? r.reasoning : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
