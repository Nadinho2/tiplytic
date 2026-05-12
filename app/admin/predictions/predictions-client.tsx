"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

type Row = {
  id: string | number;
  league?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_title?: string | null;
  prediction_type?: string | null;
  tip?: string | null;
  odds?: number | string | null;
  tier_required?: string | null;
  is_admin_pick?: boolean | null;
  match_date?: string | null;
  result?: string | null;
  source?: string | null;
  created_at?: string | null;
};

type ApiResponse = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

function formatMatchTitle(r: Row) {
  const t = r.match_title;
  if (t) return t;
  const home = r.home_team ?? "Home";
  const away = r.away_team ?? "Away";
  return `${home} vs ${away}`;
}

function BadgeResult({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls =
    v === "win"
      ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
      : v === "loss"
        ? "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
        : v === "void"
          ? "border-white/10 bg-white/[0.03] text-white/70"
          : "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#F59E0B]";
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", cls)}>{value.toUpperCase()}</span>;
}

export function PredictionsClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse>({ rows: [], total: 0, page: 0, pageSize: 25 });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const q = sp.get("q") ?? "";
  const result = sp.get("result") ?? "all";
  const tier = sp.get("tier") ?? "all";
  const league = sp.get("league") ?? "All";
  const isAdminPick = sp.get("is_admin_pick") ?? "all";
  const page = Number(sp.get("page") ?? "0") || 0;
  const updateId = sp.get("update") ?? "";

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (!value || value === "all" || value === "All") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    router.replace(`/admin/predictions?${next.toString()}`);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (result !== "all") qs.set("result", result);
      if (tier !== "all") qs.set("tier", tier);
      if (league !== "All") qs.set("league", league);
      if (isAdminPick !== "all") qs.set("is_admin_pick", isAdminPick);
      qs.set("page", String(page));

      const res = await fetch(`/api/admin/predictions?${qs.toString()}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as ApiResponse | null;
      if (cancelled) return;
      if (!res || !res.ok || !json) {
        setData({ rows: [], total: 0, page: 0, pageSize: 25, error: "Failed to load" });
        setSelected({});
        setLoading(false);
        return;
      }
      setData(json);
      setSelected({});
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAdminPick, league, page, q, result, tier]);

  async function bulkDelete() {
    if (!selectedIds.length) return;
    const ok = window.confirm(`Delete ${selectedIds.length} predictions?`);
    if (!ok) return;
    const res = await fetch("/api/admin/predictions/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bulk_delete", ids: selectedIds }),
    }).catch(() => null);
    if (!res || !res.ok) {
      toast.error("Bulk delete failed");
      return;
    }
    toast.success("Deleted");
    router.refresh();
    router.replace(`/admin/predictions?${sp.toString()}`);
  }

  async function bulkResult(nextResult: "win" | "loss" | "void") {
    if (!selectedIds.length) return;
    const ok = window.confirm(`Set result=${nextResult.toUpperCase()} for ${selectedIds.length} predictions?`);
    if (!ok) return;
    const res = await fetch("/api/admin/predictions/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bulk_result", ids: selectedIds, result: nextResult }),
    }).catch(() => null);
    if (!res || !res.ok) {
      toast.error("Bulk update failed");
      return;
    }
    toast.success("Updated");
    router.refresh();
    router.replace(`/admin/predictions?${sp.toString()}`);
  }

  async function updateResult(predictionId: string, nextResult: "win" | "loss" | "void") {
    const res = await fetch(`/api/admin/predictions/${encodeURIComponent(predictionId)}/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: nextResult }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { updatedCommunity?: number; settled?: number; error?: string } | null;
    if (!res || !res.ok) {
      toast.error(json?.error || "Update failed");
      return;
    }
    toast.success(`Result updated (community: ${json?.updatedCommunity ?? 0}, settled: ${json?.settled ?? 0})`);
    const next = new URLSearchParams(sp.toString());
    next.delete("update");
    router.replace(`/admin/predictions?${next.toString()}`);
    router.refresh();
  }

  async function toggleAdminPick(predictionId: string, next: boolean) {
    const ok = window.confirm(next ? "Set as Admin Pick?" : "Remove Admin Pick?");
    if (!ok) return;
    const res = await fetch(`/api/admin/predictions/${encodeURIComponent(predictionId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_admin_pick: next }),
    }).catch(() => null);
    if (!res || !res.ok) {
      toast.error("Failed");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }

  async function deleteOne(predictionId: string) {
    const ok = window.confirm("Delete this prediction?");
    if (!ok) return;
    const res = await fetch(`/api/admin/predictions/${encodeURIComponent(predictionId)}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    router.refresh();
  }

  const totalPages = Math.max(1, Math.ceil((data.total ?? 0) / (data.pageSize ?? 25)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Predictions</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">All predictions</h1>
          <p className="mt-2 text-sm text-muted">Search, filter, bulk actions, and result updates.</p>
        </div>
        <Link
          href="/admin/predictions/new"
          className="inline-flex rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3B82F6]/90"
        >
          Add prediction
        </Link>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <input
              value={q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search match, league, or tip…"
              className="lg:col-span-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
            />
            <select
              value={result}
              onChange={(e) => setParam("result", e.target.value)}
              className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All results</option>
              <option value="pending">Pending</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="void">Void</option>
            </select>
            <select
              value={tier}
              onChange={(e) => setParam("tier", e.target.value)}
              className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
            <select
              value={league}
              onChange={(e) => setParam("league", e.target.value)}
              className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="All">All leagues</option>
              <option value="EPL">EPL</option>
              <option value="La Liga">La Liga</option>
              <option value="Champions League">Champions League</option>
              <option value="Serie A">Serie A</option>
              <option value="Bundesliga">Bundesliga</option>
              <option value="Ligue 1">Ligue 1</option>
              <option value="Others">Others</option>
            </select>
            <select
              value={isAdminPick}
              onChange={(e) => setParam("is_admin_pick", e.target.value)}
              className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">Admin pick: all</option>
              <option value="true">Admin pick: yes</option>
              <option value="false">Admin pick: no</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => bulkResult("win")}
              disabled={!selectedIds.length}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Bulk WIN
            </button>
            <button
              type="button"
              onClick={() => bulkResult("loss")}
              disabled={!selectedIds.length}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Bulk LOSS
            </button>
            <button
              type="button"
              onClick={() => bulkResult("void")}
              disabled={!selectedIds.length}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Bulk VOID
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={!selectedIds.length}
              className="rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/10 px-3 py-2 text-xs font-semibold text-[#EF4444] disabled:opacity-40"
            >
              Bulk Delete
            </button>

            <div className="ml-auto text-xs text-muted">
              {data.total.toLocaleString()} total
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
            <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={data.rows.length > 0 && selectedIds.length === data.rows.length}
                  onChange={(e) => {
                    const next: Record<string, boolean> = {};
                    if (e.target.checked) {
                      for (const r of data.rows) next[String(r.id)] = true;
                    }
                    setSelected(next);
                  }}
                />
              </div>
              <div className="col-span-3">Match</div>
              <div className="col-span-1">League</div>
              <div className="col-span-2">Tip</div>
              <div className="col-span-1 text-right">Odds</div>
              <div className="col-span-1">Tier</div>
              <div className="col-span-1">Admin</div>
              <div className="col-span-1">Result</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {loading ? (
              <div className="px-4 py-8 text-sm text-muted">Loading…</div>
            ) : data.rows.length ? (
              <div className="divide-y divide-border">
                {data.rows.map((r) => {
                  const id = String(r.id);
                  const isPick = Boolean(r.is_admin_pick);
                  return (
                    <div key={id} className="grid grid-cols-12 items-start gap-2 px-4 py-3 text-sm">
                      <div className="col-span-1 pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[id])}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [id]: e.target.checked }))}
                        />
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="truncate font-semibold text-foreground">{formatMatchTitle(r)}</div>
                        <div className="mt-1 text-xs text-muted">
                          {r.match_date ? new Date(r.match_date).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="col-span-1 text-muted">{r.league ?? "—"}</div>
                      <div className="col-span-2 min-w-0">
                        <div className="truncate text-foreground">{r.tip ?? "—"}</div>
                        <div className="mt-1 text-xs text-muted">{r.prediction_type ?? "—"}</div>
                      </div>
                      <div className="col-span-1 text-right text-muted">{Number(r.odds ?? 0).toFixed(2)}</div>
                      <div className="col-span-1">
                        <Badge className="bg-white/5 text-white/80">{String(r.tier_required ?? "free").toUpperCase()}</Badge>
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => void toggleAdminPick(id, !isPick)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-semibold",
                            isPick ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/[0.03] text-white/70",
                          )}
                        >
                          {isPick ? "YES" : "NO"}
                        </button>
                      </div>
                      <div className="col-span-1">
                        <BadgeResult value={String(r.result ?? "pending")} />
                      </div>
                      <div className="col-span-1 flex justify-end gap-2">
                        <Link
                          href={`/admin/predictions/new?edit=${encodeURIComponent(id)}`}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new URLSearchParams(sp.toString());
                            next.set("update", id);
                            router.replace(`/admin/predictions?${next.toString()}`);
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Result
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteOne(id)}
                          className="rounded-lg border border-[#EF4444]/25 bg-[#EF4444]/10 px-2 py-1 text-xs font-semibold text-[#EF4444]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted">No predictions found.</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setParam("page", String(Math.max(0, page - 1)))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Prev
            </button>
            <div className="text-xs text-muted">
              Page {page + 1} / {totalPages}
            </div>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </CardContent>
      </Card>

      {updateId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setParam("update", "")} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1320] p-5">
            <div className="text-base font-semibold">Update Result</div>
            <div className="mt-1 text-xs text-muted">Prediction ID: {updateId}</div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void updateResult(updateId, "win")}
                className="rounded-xl border border-[#10B981]/25 bg-[#10B981]/10 px-3 py-2 text-sm font-semibold text-[#10B981]"
              >
                WIN
              </button>
              <button
                type="button"
                onClick={() => void updateResult(updateId, "loss")}
                className="rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/10 px-3 py-2 text-sm font-semibold text-[#EF4444]"
              >
                LOSS
              </button>
              <button
                type="button"
                onClick={() => void updateResult(updateId, "void")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white"
              >
                VOID
              </button>
            </div>
            <button
              type="button"
              onClick={() => setParam("update", "")}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

