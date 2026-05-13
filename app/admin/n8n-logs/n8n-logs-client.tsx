"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type Row = {
  id: string;
  webhook_type: string;
  payload: unknown;
  status: string;
  error_message: string | null;
  received_at: string;
};

type ApiResponse = { rows: Row[]; total: number; error?: string };

type CronRow = {
  id: string;
  job: string;
  status: string;
  details: unknown;
  created_at: string;
};

type CronApiResponse = { rows: CronRow[]; lastSuccess: CronRow | null; error?: string };

function statusPill(status: string) {
  const s = status.toLowerCase();
  return s === "success"
    ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
    : "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]";
}

function ageHours(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3_600_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toInt(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function extractRecordsProcessed(details: unknown) {
  if (!isRecord(details)) return null;
  const v = details.recordsProcessed ?? details.records_processed ?? details.saved ?? details.records_saved;
  return toInt(v);
}

function extractErrorMessage(details: unknown) {
  if (!isRecord(details)) return null;
  const v = details.error_message ?? details.error ?? details.message;
  return typeof v === "string" && v.trim() ? v : null;
}

function nextDailyRunUtc(hourUtc: number, minuteUtc: number) {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, minuteUtc, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function formatWAT(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      timeZone: "Africa/Lagos",
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

export function N8nLogsClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"all" | "success" | "failed">("all");
  const [type, setType] = useState<"all" | "prediction" | "result">("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const [cronLoading, setCronLoading] = useState(true);
  const [cronRows, setCronRows] = useState<CronRow[]>([]);
  const [cronLastSuccess, setCronLastSuccess] = useState<CronRow | null>(null);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowResult, setRunNowResult] = useState<{ saved: number; skipped: number; errors: string[] } | null>(null);

  const health = useMemo(() => {
    const latest = rows[0]?.received_at ?? null;
    if (!latest) return { label: "No data", cls: "bg-white/5 text-white/70" };
    const h = ageHours(latest);
    if (h == null) return { label: "Unknown", cls: "bg-white/5 text-white/70" };
    if (h <= 24) return { label: "Healthy", cls: "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25" };
    if (h <= 48) return { label: "Degraded", cls: "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25" };
    return { label: "Down", cls: "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25" };
  }, [rows]);

  const cronHealth = useMemo(() => {
    const ts = cronLastSuccess?.created_at ?? null;
    if (!ts) return { label: "No runs", cls: "bg-white/5 text-white/70" };
    const h = ageHours(ts);
    if (h == null) return { label: "Unknown", cls: "bg-white/5 text-white/70" };
    if (h < 25) return { label: "Healthy", cls: "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25" };
    if (h <= 48) return { label: "Degraded", cls: "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25" };
    return { label: "Down", cls: "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25" };
  }, [cronLastSuccess?.created_at]);

  const nextRunLabel = useMemo(() => {
    const next = nextDailyRunUtc(2, 0);
    return formatWAT(next);
  }, []);

  const lastSuccessLabel = useMemo(() => {
    const ts = cronLastSuccess?.created_at ?? null;
    if (!ts) return "—";
    const h = ageHours(ts);
    if (h == null) return "—";
    const hours = Math.floor(h);
    if (hours < 1) return "Just now";
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }, [cronLastSuccess?.created_at]);

  useEffect(() => {
    let cancelled = false;
    async function loadCron() {
      setCronLoading(true);
      const res = await fetch("/api/admin/cron-logs?job=daily_predictions_fetch&limit=30", {
        method: "GET",
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as CronApiResponse | null;
      if (cancelled) return;
      if (!res || !res.ok || !json) {
        setCronRows([]);
        setCronLastSuccess(null);
        setCronLoading(false);
        return;
      }
      setCronRows(json.rows ?? []);
      setCronLastSuccess(json.lastSuccess ?? null);
      setCronLoading(false);
    }
    void loadCron();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const qs = new URLSearchParams();
      if (status !== "all") qs.set("status", status);
      if (type !== "all") qs.set("type", type);
      const res = await fetch(`/api/admin/webhook-logs?${qs.toString()}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as ApiResponse | null;
      if (cancelled) return;
      if (!res || !res.ok || !json) {
        setRows([]);
        setLoading(false);
        return;
      }
      setRows(json.rows ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [status, type]);

  async function runNow() {
    setRunNowResult(null);
    setRunNowLoading(true);
    const res = await fetch("/api/cron/fetch-predictions/trigger", { method: "POST" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as
      | { success?: boolean; saved?: number; skipped?: number; errors?: unknown; error?: string }
      | null;
    if (!res || !res.ok || !json || !json.success) {
      toast.error(json?.error || "Run now failed");
      setRunNowLoading(false);
      return;
    }

    const errors = Array.isArray(json.errors) ? json.errors.filter((e): e is string => typeof e === "string") : [];
    setRunNowResult({
      saved: typeof json.saved === "number" ? json.saved : 0,
      skipped: typeof json.skipped === "number" ? json.skipped : 0,
      errors,
    });
    toast.success(`Saved ${json.saved ?? 0}, skipped ${json.skipped ?? 0}`);

    const res2 = await fetch("/api/admin/cron-logs?job=daily_predictions_fetch&limit=30", {
      method: "GET",
    }).catch(() => null);
    const json2 = (await res2?.json().catch(() => null)) as CronApiResponse | null;
    if (res2 && res2.ok && json2) {
      setCronRows(json2.rows ?? []);
      setCronLastSuccess(json2.lastSuccess ?? null);
    }
    setRunNowLoading(false);
  }

  async function reprocess(id: string) {
    const ok = window.confirm("Re-process this webhook?");
    if (!ok) return;
    const res = await fetch("/api/admin/webhook-logs/reprocess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res || !res.ok) {
      toast.error(json?.error || "Re-process failed");
      return;
    }
    toast.success("Re-processed");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">N8N Logs</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Webhook logs</h1>
          <p className="mt-2 text-sm text-muted">Last 100 events, status filters, raw payload viewer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("rounded-xl px-3 py-2 text-sm font-semibold", cronHealth.cls)}>
            Cron: {cronHealth.label}
          </div>
          <div className={cn("rounded-xl px-3 py-2 text-sm font-semibold", health.cls)}>
            Webhooks: {health.label}
          </div>
        </div>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Daily predictions fetch</div>
              <div className="mt-1 text-sm text-muted">
                Next automatic fetch: <span className="font-medium text-foreground">{nextRunLabel} WAT</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                Last successful run: <span className="font-medium text-foreground">{lastSuccessLabel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runNow()}
              disabled={runNowLoading}
              className="inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {runNowLoading ? "Running…" : "Run Now"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {runNowResult ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              Saved {runNowResult.saved} • Skipped {runNowResult.skipped} • Errors {runNowResult.errors.length}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
            <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
              <div className="col-span-3">Timestamp</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Processed</div>
              <div className="col-span-5">Message</div>
            </div>
            {cronLoading ? (
              <div className="px-4 py-8 text-sm text-muted">Loading…</div>
            ) : cronRows.length ? (
              <div className="divide-y divide-border">
                {cronRows.map((r) => (
                  <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                    <div className="col-span-3 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</div>
                    <div className="col-span-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                          statusPill(r.status),
                        )}
                      >
                        {String(r.status).toUpperCase()}
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-muted">
                      {extractRecordsProcessed(r.details)?.toLocaleString() ?? "—"}
                    </div>
                    <div className="col-span-5 truncate text-muted">
                      {extractErrorMessage(r.details) ?? "OK"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted">No cron logs found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | "success" | "failed")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "all" | "prediction" | "result")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All types</option>
              <option value="prediction">prediction</option>
              <option value="result">result</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
            <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
              <div className="col-span-2">Timestamp</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-5">Summary</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {loading ? (
              <div className="px-4 py-8 text-sm text-muted">Loading…</div>
            ) : rows.length ? (
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                    <div className="col-span-2 text-xs text-muted">{new Date(r.received_at).toLocaleString()}</div>
                    <div className="col-span-2 font-semibold text-foreground">{String(r.webhook_type)}</div>
                    <div className="col-span-2">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", statusPill(r.status))}>
                        {r.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="col-span-5 truncate text-muted">
                      {r.error_message ? `Error: ${r.error_message}` : "OK"}
                    </div>
                    <div className="col-span-1 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white"
                      >
                        View
                      </button>
                      {String(r.status).toLowerCase() === "failed" ? (
                        <button
                          type="button"
                          onClick={() => void reprocess(r.id)}
                          className="rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-2 py-1 text-xs font-semibold text-[#F59E0B]"
                        >
                          Re-process
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted">No webhook logs found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0D1320] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-base font-semibold">Raw payload</div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
            <pre className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/80">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
