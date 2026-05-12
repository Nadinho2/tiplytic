"use client";

import { useMemo, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { canAccessTier } from "@/lib/tier-access";

type ResultFilter = "All" | "Win" | "Loss" | "Pending" | "Void";

type Row = {
  created_at?: string | null;
  match?: string | null;
  tip?: string | null;
  odds?: number | string | null;
  result?: string | null;
  profit_loss?: number | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value?: number | null) {
  const n = value ?? 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}

function resultBadgeClass(result: string) {
  const v = result.toLowerCase();
  if (v === "win") return "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]";
  if (v === "loss") return "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]";
  if (v === "void") return "border-white/10 bg-white/[0.03] text-muted";
  return "border-white/10 bg-white/[0.03] text-muted";
}

function toCsv(rows: Row[]) {
  const header = ["Date", "Match", "Tip", "Odds", "Result", "P&L"];
  const lines = rows.map((r) => [
    formatDate(r.created_at),
    r.match ?? "",
    r.tip ?? "",
    r.odds ?? "",
    r.result ?? "",
    r.profit_loss ?? "",
  ]);
  return [header, ...lines]
    .map((l) =>
      l
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PredictionHistoryTable({
  rows,
  userTier,
}: {
  rows: Row[];
  userTier: string;
}) {
  const [filter, setFilter] = useState<ResultFilter>("All");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    if (f === "all") return rows;
    return rows.filter((r) => String(r.result ?? "").toLowerCase() === f);
  }, [filter, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageSafe = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, pageSafe]);

  const canExport = canAccessTier(userTier, "pro");

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Prediction History
          </div>
          <div className="mt-1 text-sm text-muted">
            Filter your results and track P&amp;L.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["All", "Win", "Loss", "Pending", "Void"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setFilter(v);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                filter === v
                  ? "border-accent/40 bg-accent-soft text-foreground"
                  : "border-border bg-background/20 text-muted hover:border-accent/30",
              )}
            >
              {v}
            </button>
          ))}

          {canExport ? (
            <button
              type="button"
              onClick={() =>
                downloadCsv("prediction-history.csv", toCsv(filtered))
              }
              className="rounded-full border border-accent/35 bg-accent-soft px-3 py-1 text-xs font-semibold text-foreground"
            >
              Export CSV
            </button>
          ) : (
            <ButtonLink href="/pricing" variant="secondary" size="sm">
              Export (Pro)
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
          <div className="col-span-3">Date</div>
          <div className="col-span-4">Match</div>
          <div className="col-span-3">Tip</div>
          <div className="col-span-1 text-right">Odds</div>
          <div className="col-span-1 text-right">P&amp;L</div>
        </div>
        <div className="divide-y divide-border bg-card/40">
          {pageRows.length ? (
            pageRows.map((r, idx) => (
              <div
                key={`${r.created_at ?? "row"}-${idx}`}
                className="grid grid-cols-12 items-center gap-y-2 px-4 py-3 text-sm"
              >
                <div className="col-span-12 text-muted sm:col-span-3">
                  {formatDate(r.created_at)}
                </div>
                <div className="col-span-12 font-medium text-foreground sm:col-span-4">
                  {r.match ?? "—"}
                  <div className="mt-1 sm:hidden">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                        resultBadgeClass(String(r.result ?? "pending")),
                      )}
                    >
                      {String(r.result ?? "pending").toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="col-span-8 text-muted sm:col-span-3">
                  {r.tip ?? "—"}
                  <div className="mt-1 hidden sm:block">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                        resultBadgeClass(String(r.result ?? "pending")),
                      )}
                    >
                      {String(r.result ?? "pending").toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-right text-foreground sm:col-span-1">
                  {r.odds ?? "—"}
                </div>
                <div
                  className={cn(
                    "col-span-2 text-right font-medium sm:col-span-1",
                    (r.profit_loss ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]",
                  )}
                >
                  {formatMoney(r.profit_loss)}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted">
              No predictions in this filter.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <div>
          Page {pageSafe} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
            className="rounded-xl border border-border bg-background/20 px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
            className="rounded-xl border border-border bg-background/20 px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
