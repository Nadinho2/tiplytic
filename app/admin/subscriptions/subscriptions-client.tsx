"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type SubscriptionRow = {
  clerk_user_id: string;
  tier: string | null;
  status: string | null;
  interval?: string | null;
  expires_at?: string | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: { id: string; name: string; email: string | null; username: string | null } | null;
};

type PaymentRow = {
  reference?: string | null;
  user_id?: string | null;
  email?: string | null;
  tier?: string | null;
  interval?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  user?: { id: string; name: string; email: string | null; username: string | null } | null;
};

type SubscriptionsResponse = {
  tab: "subscriptions";
  summary: { activePaid: number; trialing: number; expiringSoon: number } | null;
  subscriptions: SubscriptionRow[];
  page: number;
  pageSize: number;
  total: number;
  tableMissing?: boolean;
  error?: string;
};

type RevenueResponse = {
  tab: "revenue";
  summary:
    | { revenueToday: number; revenueMonth: number; revenueLast7Days: number; successCount: number; failedCount: number }
    | null;
  payments: PaymentRow[];
  page: number;
  pageSize: number;
  total: number;
  tableMissing?: boolean;
  error?: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function normalizeTab(value: string) {
  return value === "revenue" ? "revenue" : "subscriptions";
}

export function SubscriptionsClient({ initialTab }: { initialTab: string }) {
  const tab = normalizeTab(initialTab);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [tier, setTier] = useState<"all" | "free" | "basic" | "pro" | "elite">("all");
  const [status, setStatus] = useState("all");
  const [payStatus, setPayStatus] = useState<"all" | "success" | "failed" | "pending">("all");

  const [subsData, setSubsData] = useState<SubscriptionsResponse | null>(null);
  const [revData, setRevData] = useState<RevenueResponse | null>(null);

  useEffect(() => {
    setPage(0);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      const qs = new URLSearchParams();
      qs.set("tab", tab);
      qs.set("page", String(page));
      if (tab === "subscriptions") {
        if (tier !== "all") qs.set("tier", tier);
        if (status !== "all") qs.set("status", status);
      } else {
        if (payStatus !== "all") qs.set("status", payStatus);
      }

      const res = await fetch(`/api/admin/subscriptions?${qs.toString()}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as (SubscriptionsResponse | RevenueResponse | { error?: string }) | null;
      if (cancelled) return;

      if (!res || !res.ok || !json || (json as { error?: string }).error && !(json as any).tab) {
        toast.error((json as any)?.error || "Failed to load");
        setLoading(false);
        return;
      }

      if ((json as any).tab === "subscriptions") setSubsData(json as SubscriptionsResponse);
      if ((json as any).tab === "revenue") setRevData(json as RevenueResponse);

      if ((json as any).tableMissing) {
        toast.error((json as any).error || "Required table is missing in Supabase");
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [page, payStatus, status, tab, tier]);

  const totalPages = useMemo(() => {
    const total = tab === "subscriptions" ? (subsData?.total ?? 0) : (revData?.total ?? 0);
    const pageSize = tab === "subscriptions" ? (subsData?.pageSize ?? 25) : (revData?.pageSize ?? 25);
    return Math.max(1, Math.ceil(total / pageSize));
  }, [revData?.pageSize, revData?.total, subsData?.pageSize, subsData?.total, tab]);

  const disableActions = Boolean((tab === "subscriptions" ? subsData?.tableMissing : revData?.tableMissing));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Users</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Subscriptions & revenue</h1>
          <p className="mt-2 text-sm text-muted">Payments and subscription status overview.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/subscriptions?tab=subscriptions"
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "subscriptions" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Subscriptions
        </Link>
        <Link
          href="/admin/subscriptions?tab=revenue"
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "revenue" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Revenue
        </Link>
      </div>

      {tab === "subscriptions" ? (
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">User subscriptions</div>
                <div className="mt-1 text-sm text-muted">Backed by public.user_subscriptions.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={tier}
                  onChange={(e) => { setTier(e.target.value as any); setPage(0); }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
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
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Status filter (active/trialing/expired)…"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subsData?.summary ? (
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Active paid</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{subsData.summary.activePaid}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Trialing</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{subsData.summary.trialing}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Expiring (7 days)</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{subsData.summary.expiringSoon}</div>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">Loading…</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-4">User</div>
                  <div className="col-span-2">Tier</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Expires</div>
                  <div className="col-span-2 text-right">Updated</div>
                </div>
                <div className="divide-y divide-border">
                  {(subsData?.subscriptions ?? []).map((s) => (
                    <div key={s.clerk_user_id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                      <div className="col-span-4 min-w-0">
                        <div className="truncate text-foreground">{s.user?.name ?? s.clerk_user_id}</div>
                        <div className="mt-1 truncate text-xs text-muted">{s.user?.email ?? s.user?.username ?? s.clerk_user_id}</div>
                      </div>
                      <div className="col-span-2 text-foreground">{String(s.tier ?? "free").toUpperCase()}</div>
                      <div className="col-span-2 text-muted">{String(s.status ?? "active")}</div>
                      <div className="col-span-2 text-muted">{formatDate(s.expires_at)}</div>
                      <div className="col-span-2 text-right text-xs text-muted">{formatDate(s.updated_at)}</div>
                    </div>
                  ))}
                  {!subsData?.subscriptions?.length ? (
                    <div className="px-4 py-10 text-center text-sm text-muted">No subscriptions found.</div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={page <= 0 || loading}
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
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Revenue</div>
                <div className="mt-1 text-sm text-muted">Backed by public.payments.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={payStatus}
                  onChange={(e) => { setPayStatus(e.target.value as any); setPage(0); }}
                  disabled={disableActions}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                >
                  <option value="all">All statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {revData?.summary ? (
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Revenue today</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(revData.summary.revenueToday)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Revenue last 7 days</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(revData.summary.revenueLast7Days)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Revenue this month</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{formatMoney(revData.summary.revenueMonth)}</div>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">Loading…</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-4">User</div>
                  <div className="col-span-2">Tier</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-2 text-right">Created</div>
                </div>
                <div className="divide-y divide-border">
                  {(revData?.payments ?? []).map((p, idx) => (
                    <div
                      key={`${String(p.reference ?? "")}:${String(p.user_id ?? "")}:${String(p.created_at ?? "")}:${idx}`}
                      className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm"
                    >
                      <div className="col-span-4 min-w-0">
                        <div className="truncate text-foreground">{p.user?.name ?? p.email ?? p.user_id ?? "—"}</div>
                        <div className="mt-1 truncate text-xs text-muted">{p.user?.email ?? p.email ?? p.user_id ?? "—"}</div>
                      </div>
                      <div className="col-span-2 text-foreground">{String(p.tier ?? "—").toUpperCase()}</div>
                      <div className="col-span-2 text-muted">{String(p.status ?? "—")}</div>
                      <div className="col-span-2 text-right text-foreground">{formatMoney(p.amount ?? 0)}</div>
                      <div className="col-span-2 text-right text-xs text-muted">{formatDate(p.created_at)}</div>
                    </div>
                  ))}
                  {!revData?.payments?.length ? (
                    <div className="px-4 py-10 text-center text-sm text-muted">No payments found.</div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={page <= 0 || loading}
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
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
