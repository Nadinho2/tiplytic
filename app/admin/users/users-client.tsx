"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type Row = {
  id: string;
  email: string | null;
  name: string;
  username: string | null;
  joinedAt: number | null;
  lastActiveAt: number | null;
  tier: string;
  subscriptionStatus: string;
  expiresAt: string | null;
};

type ApiResponse = { rows: Row[]; total: number; page: number; pageSize: number; error?: string };

function tierPill(tier: string) {
  const t = tier.toLowerCase();
  if (t === "elite") return "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]";
  if (t === "pro") return "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]";
  if (t === "basic") return "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#F59E0B]";
  return "border-white/10 bg-white/[0.03] text-white/70";
}

export function UsersClient() {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | "free" | "basic" | "pro" | "elite">("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse>({ rows: [], total: 0, page: 0, pageSize: 25 });

  const [selected, setSelected] = useState<Row | null>(null);
  const [tierDraft, setTierDraft] = useState<"free" | "basic" | "pro" | "elite">("free");
  const [savingTier, setSavingTier] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (tier !== "all") qs.set("tier", tier);
      if (status !== "all") qs.set("status", status);
      qs.set("page", String(page));
      const res = await fetch(`/api/admin/users?${qs.toString()}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as ApiResponse | null;
      if (cancelled) return;
      if (!res || !res.ok || !json) {
        toast.error(json?.error || "Failed to load users");
        setData({ rows: [], total: 0, page: 0, pageSize: 25, error: "Failed" });
        setLoading(false);
        return;
      }
      setData(json);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, q, status, tier]);

  useEffect(() => {
    if (!selected) return;
    const t = selected.tier.toLowerCase();
    setTierDraft(t === "elite" ? "elite" : t === "pro" ? "pro" : t === "basic" ? "basic" : "free");
  }, [selected]);

  async function saveTier() {
    if (!selected) return;
    const ok = window.confirm(`Set tier to ${tierDraft.toUpperCase()} for this user?`);
    if (!ok) return;

    setSavingTier(true);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(selected.id)}/tier`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier: tierDraft }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSavingTier(false);
    if (!res || !res.ok || !json?.ok) {
      toast.error(json?.error || "Failed to update tier");
      return;
    }
    toast.success("Tier updated");
    setSelected((prev) => (prev ? { ...prev, tier: tierDraft } : prev));
    setData((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === selected.id ? { ...r, tier: tierDraft } : r)),
    }));
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total ?? 0) / (data.pageSize ?? 25))), [data.pageSize, data.total]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Users</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">All users</h1>
        <p className="mt-2 text-sm text-muted">Clerk users joined with subscription tier.</p>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Search email or name…"
              className="lg:col-span-6 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
            />
            <select
              value={tier}
              onChange={(e) => { setTier(e.target.value as "all" | "free" | "basic" | "pro" | "elite"); setPage(0); }}
              className="lg:col-span-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
            <input
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              placeholder="Status filter (active/cancelled/expired)…"
              className="lg:col-span-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
            <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
              <div className="col-span-3">Email</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Joined</div>
            </div>
            {loading ? (
              <div className="px-4 py-8 text-sm text-muted">Loading…</div>
            ) : data.rows.length ? (
              <div className="divide-y divide-border">
                {data.rows.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelected(u)}
                    className="grid w-full grid-cols-12 items-center gap-2 px-4 py-3 text-left text-sm hover:bg-white/[0.03]"
                  >
                    <div className="col-span-3 truncate text-foreground">{u.email ?? "—"}</div>
                    <div className="col-span-3 truncate text-foreground">{u.name}</div>
                    <div className="col-span-2">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", tierPill(u.tier))}>
                        {u.tier.toUpperCase()}
                      </span>
                    </div>
                    <div className="col-span-2 truncate text-muted">{u.subscriptionStatus}</div>
                    <div className="col-span-2 text-right text-xs text-muted">
                      {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : "—"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted">No users found.</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
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
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative ml-auto h-full w-full max-w-md border-l border-white/10 bg-[#0D1320] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-white">{selected.name}</div>
                <div className="mt-1 text-xs text-white/60">{selected.email ?? "—"}</div>
                <div className="mt-2 text-[11px] text-white/40">Clerk ID: {selected.id}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Tier</div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={tierDraft}
                    onChange={(e) => setTierDraft(e.target.value as "free" | "basic" | "pro" | "elite")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="free">FREE</option>
                    <option value="basic">BASIC</option>
                    <option value="pro">PRO</option>
                    <option value="elite">ELITE</option>
                  </select>
                  <button
                    type="button"
                    disabled={savingTier}
                    onClick={() => void saveTier()}
                    className="shrink-0 rounded-xl bg-[#3B82F6] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {savingTier ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Subscription status</div>
                <div className="mt-1 text-sm font-semibold text-white">{selected.subscriptionStatus}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Last active</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selected.lastActiveAt ? new Date(selected.lastActiveAt).toLocaleString() : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Expires</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selected.expiresAt ? new Date(selected.expiresAt).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
