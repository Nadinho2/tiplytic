"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { getDailyPredictionLimit } from "@/lib/tier-access";
import { cn } from "@/utils/cn";

type SubRow = {
  tier: string | null;
  status: string | null;
  expires_at: string | null;
};

type PaymentRow = {
  amount: number | null;
  tier: string | null;
  interval: string | null;
  status: string | null;
  created_at: string | null;
  reference?: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeTier(v: string | null | undefined) {
  const s = String(v ?? "free").toLowerCase();
  return s === "elite" ? "elite" : s === "pro" ? "pro" : s === "basic" ? "basic" : "free";
}

export function SubscriptionClient({
  subscription,
  payments,
  usageToday,
}: {
  subscription: SubRow;
  payments: PaymentRow[];
  usageToday: number;
}) {
  const tier = normalizeTier(subscription.tier);
  const status = String(subscription.status ?? "active").toLowerCase();
  const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
  const limit = getDailyPredictionLimit(tier);
  const usageLabel = limit === Number.POSITIVE_INFINITY ? `${usageToday}` : `${usageToday} / ${limit}`;

  const [loadingAction, setLoadingAction] = useState<null | "pause" | "cancel">(null);
  const [upgrading, setUpgrading] = useState(false);

  const isExpired = status === "expired" || status === "cancelled";
  const isPaused = status === "paused";

  const planTitle = useMemo(() => {
    if (tier === "elite") return "Elite";
    if (tier === "pro") return "Pro";
    if (tier === "basic") return "Basic";
    return "Free";
  }, [tier]);

  async function pause() {
    const ok = window.confirm("Pause subscription? Access will be blocked until unpaused.");
    if (!ok) return;
    setLoadingAction("pause");
    const res = await fetch("/api/subscriptions/pause", { method: "POST" }).catch(() => null);
    setLoadingAction(null);
    if (!res || !res.ok) {
      toast.error("Pause failed");
      return;
    }
    toast.success("Subscription paused");
    window.location.reload();
  }

  async function cancel() {
    const ok = window.confirm("Cancel subscription? This will downgrade you to Free.");
    if (!ok) return;
    setLoadingAction("cancel");
    const res = await fetch("/api/subscriptions/cancel", { method: "POST" }).catch(() => null);
    setLoadingAction(null);
    if (!res || !res.ok) {
      toast.error("Cancel failed");
      return;
    }
    toast.success("Subscription cancelled");
    window.location.reload();
  }

  async function upgrade(tier: "basic" | "pro" | "elite", interval: "monthly" | "annual") {
    setUpgrading(true);
    const res = await fetch("/api/payments/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier, interval }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { authorizationUrl?: string; redirectUrl?: string; error?: string } | null;
    setUpgrading(false);
    if (!res || !res.ok) {
      toast.error(json?.error || "Failed to initialize checkout");
      return;
    }
    if (json?.authorizationUrl) {
      window.location.href = json.authorizationUrl;
      return;
    }
    if (json?.redirectUrl) {
      window.location.href = json.redirectUrl;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Subscription</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage your plan</h1>
          <p className="mt-2 text-sm text-muted">Billing status, renewal, and history.</p>
        </div>
        <ButtonLink href="/pricing" variant="secondary">
          Upgrade
        </ButtonLink>
      </div>

      {isExpired ? (
        <div className="rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/10 p-4 text-sm text-[#EF4444]">
          Your subscription has ended. Upgrade to regain access.
        </div>
      ) : isPaused ? (
        <div className="rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 p-4 text-sm text-[#F59E0B]">
          Your subscription is paused.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="bg-[#0D1320] lg:col-span-2">
          <CardHeader>
            <div className="text-sm font-semibold">Current plan</div>
            <div className="mt-1 text-sm text-muted">Your active tier and renewal date.</div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Plan</div>
                <div className="mt-2 text-2xl font-semibold text-white">{planTitle}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Status</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.toUpperCase()}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Renewal</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {expiresAt ? expiresAt.toLocaleString() : "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-muted">Usage (today)</div>
              <div className="mt-2 text-sm font-semibold text-white">
                Predictions used: {usageLabel}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={upgrading || tier === "elite"}
                onClick={() => void upgrade(tier === "free" ? "basic" : tier === "basic" ? "pro" : "elite", "monthly")}
                className="rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {upgrading ? "Redirecting…" : tier === "elite" ? "Elite" : "Upgrade"}
              </button>
              <button
                type="button"
                disabled={loadingAction === "pause"}
                onClick={() => void pause()}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm font-semibold",
                  "border-white/10 bg-white/5 text-white disabled:opacity-60",
                )}
              >
                {loadingAction === "pause" ? "Pausing…" : "Pause subscription"}
              </button>
              <button
                type="button"
                disabled={loadingAction === "cancel"}
                onClick={() => void cancel()}
                className="rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/10 px-4 py-2 text-sm font-semibold text-[#EF4444] disabled:opacity-60"
              >
                {loadingAction === "cancel" ? "Cancelling…" : "Cancel subscription"}
              </button>
            </div>

            <div className="mt-4 text-xs text-white/50">
              Need help? <Link className="text-[#3B82F6]" href="/dashboard/settings">Contact support</Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="text-sm font-semibold">Quick upgrade</div>
            <div className="mt-1 text-sm text-muted">Monthly / Annual options.</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void upgrade("basic", "monthly")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm font-semibold text-white"
              >
                Basic — {formatMoney(2500)}/mo
              </button>
              <button
                type="button"
                onClick={() => void upgrade("basic", "annual")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm font-semibold text-white"
              >
                Basic — {formatMoney(25000)}/yr
              </button>
              <button
                type="button"
                onClick={() => void upgrade("pro", "monthly")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm font-semibold text-white"
              >
                Pro — {formatMoney(5000)}/mo
              </button>
              <button
                type="button"
                onClick={() => void upgrade("elite", "monthly")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm font-semibold text-white"
              >
                Elite — {formatMoney(10000)}/mo
              </button>
              <button
                type="button"
                onClick={() => void upgrade("pro", "annual")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm font-semibold text-white"
              >
                Pro — {formatMoney(50000)}/yr
              </button>
              <button
                type="button"
                onClick={() => void upgrade("elite", "annual")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm font-semibold text-white"
              >
                Elite — {formatMoney(100000)}/yr
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="text-sm font-semibold">Billing history</div>
          <div className="mt-1 text-sm text-muted">Recent Paystack transactions.</div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
            <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
              <div className="col-span-3">Date</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-2">Interval</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-3 text-right">Status</div>
            </div>
            {payments.length ? (
              <div className="divide-y divide-border">
                {payments.map((p, idx) => (
                  <div key={`${String(p.reference ?? "r")}-${idx}`} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                    <div className="col-span-3 text-muted">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</div>
                    <div className="col-span-2 text-foreground">{String(p.tier ?? "—").toUpperCase()}</div>
                    <div className="col-span-2 text-muted">{String(p.interval ?? "—").toUpperCase()}</div>
                    <div className="col-span-2 text-muted">{formatMoney(Number(p.amount ?? 0))}</div>
                    <div className="col-span-3 text-right">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-white/70">
                        {String(p.status ?? "—").toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted">No billing history found.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
