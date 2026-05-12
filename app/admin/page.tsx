import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createServiceClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function startOfWeekUtc(d: Date) {
  const dt = startOfUtcDay(d);
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}

function startOfUtcMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

type PaymentRow = {
  user_id?: string | null;
  tier?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type SubscriptionRow = {
  clerk_user_id?: string | null;
  user_id?: string | null;
  tier?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PredictionRow = {
  id: string | number;
  match_title?: string | null;
  match?: string | null;
  league?: string | null;
  match_date?: string | null;
  result?: string | null;
  created_at?: string | null;
};

export default async function Page() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  const supabase = createServiceClient();
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  const weekStart = startOfWeekUtc(now);
  const monthStart = startOfUtcMonth(now);

  const isoToday = todayStart.toISOString();
  const isoTomorrow = tomorrowStart.toISOString();
  const isoWeek = weekStart.toISOString();
  const isoMonth = monthStart.toISOString();
  const isoNow = now.toISOString();

  const tierCounts = { free: 0, basic: 0, pro: 0, elite: 0 };
  let totalActiveSubscribers = 0;
  let revenueToday = 0;
  let revenueMonth = 0;
  let newSignupsToday = 0;
  let churnedThisWeek = 0;
  let predictionsPostedToday = 0;
  let platformWinRateWeek = 0;
  let communityPredictionsToday = 0;
  let failedPaymentsToday = 0;

  let recentPayments: PaymentRow[] = [];
  let recentSignups: SubscriptionRow[] = [];
  let pendingResults: PredictionRow[] = [];

  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("tier,status,created_at,updated_at")
      .limit(50_000);
    const subs = (data as SubscriptionRow[] | null) ?? [];

    for (const s of subs) {
      const tier = String(s.tier ?? "free").toLowerCase();
      if (tier === "basic") tierCounts.basic += 1;
      else if (tier === "pro") tierCounts.pro += 1;
      else if (tier === "elite") tierCounts.elite += 1;
      else tierCounts.free += 1;

      const status = String(s.status ?? "active").toLowerCase();
      if (tier !== "free" && (status === "active" || status === "trialing")) totalActiveSubscribers += 1;

      if (typeof s.created_at === "string" && s.created_at >= isoToday && s.created_at < isoTomorrow) {
        if (tier !== "free") newSignupsToday += 1;
      }

      if (typeof s.updated_at === "string" && s.updated_at >= isoWeek && s.updated_at < isoNow) {
        if (status === "expired" || status === "cancelled") churnedThisWeek += 1;
      }
    }
  } catch {}

  if (totalActiveSubscribers === 0) {
    try {
      const { count } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      totalActiveSubscribers = count ?? 0;
    } catch {}
  }

  try {
    const { data } = await supabase
      .from("payments")
      .select("user_id,tier,amount,status,created_at")
      .gte("created_at", isoToday)
      .lt("created_at", isoTomorrow)
      .limit(50_000);
    const rows = (data as PaymentRow[] | null) ?? [];
    for (const p of rows) {
      const status = String(p.status ?? "").toLowerCase();
      if (status === "success") revenueToday += p.amount ?? 0;
      if (status === "failed") failedPaymentsToday += 1;
    }
  } catch {}

  try {
    const { data } = await supabase
      .from("payments")
      .select("amount,status,created_at")
      .gte("created_at", isoMonth)
      .lt("created_at", isoNow)
      .limit(100_000);
    const rows = (data as Array<{ amount?: number | null; status?: string | null }> | null) ?? [];
    for (const p of rows) {
      if (String(p.status ?? "").toLowerCase() === "success") revenueMonth += p.amount ?? 0;
    }
  } catch {}

  try {
    const { count } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", isoToday)
      .lt("created_at", isoTomorrow);
    predictionsPostedToday = count ?? 0;
  } catch {}

  try {
    const { count: wins } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .gte("match_date", isoWeek)
      .lt("match_date", isoNow)
      .eq("result", "win");
    const { count: losses } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .gte("match_date", isoWeek)
      .lt("match_date", isoNow)
      .eq("result", "loss");
    const denom = (wins ?? 0) + (losses ?? 0);
    platformWinRateWeek = denom > 0 ? ((wins ?? 0) / denom) * 100 : 0;
  } catch {}

  try {
    const { count } = await supabase
      .from("community_predictions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", isoToday)
      .lt("created_at", isoTomorrow);
    communityPredictionsToday = count ?? 0;
  } catch {}

  try {
    const { data } = await supabase
      .from("payments")
      .select("user_id,tier,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    recentPayments = (data as PaymentRow[] | null) ?? [];
  } catch {}

  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("clerk_user_id,tier,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    recentSignups = (data as SubscriptionRow[] | null) ?? [];
  } catch {}

  try {
    const { data } = await supabase
      .from("predictions")
      .select("id,match_title,match,league,match_date,result,created_at")
      .eq("result", "pending")
      .lt("match_date", isoNow)
      .order("match_date", { ascending: true })
      .limit(25);
    pendingResults = (data as PredictionRow[] | null) ?? [];
  } catch {}

  const stats = [
    { label: "Total active subscribers", value: totalActiveSubscribers.toLocaleString() },
    { label: "Free", value: tierCounts.free.toLocaleString() },
    { label: "Basic", value: tierCounts.basic.toLocaleString() },
    { label: "Pro", value: tierCounts.pro.toLocaleString() },
    { label: "Elite", value: tierCounts.elite.toLocaleString() },
    { label: "Revenue today", value: formatMoney(revenueToday) },
    { label: "Revenue this month", value: formatMoney(revenueMonth) },
    { label: "New signups today", value: newSignupsToday.toLocaleString() },
    { label: "Churned this week", value: churnedThisWeek.toLocaleString() },
    { label: "Predictions posted today", value: predictionsPostedToday.toLocaleString() },
    { label: "Platform win rate (week)", value: `${(Math.round(platformWinRateWeek * 10) / 10).toFixed(1)}%` },
    { label: "Community predictions today", value: communityPredictionsToday.toLocaleString() },
    { label: "Failed payments today", value: failedPaymentsToday.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="mt-2 text-sm text-muted">
            Platform stats, recent activity, and urgent items.
          </p>
        </div>
        <Link
          href="/admin/predictions/new"
          className="rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3B82F6]/90"
        >
          Add prediction
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="bg-[#0D1320]">
            <CardHeader className="pb-2">
              <div className="text-xs text-muted">{s.label}</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{s.value}</div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="bg-[#0D1320] lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Pending result updates</h2>
              <Badge className="border border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]">
                Urgent
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              Predictions still pending after kickoff time.
            </p>
          </CardHeader>
          <CardContent>
            {pendingResults.length ? (
              <div className="divide-y divide-border rounded-2xl border border-border bg-background/30">
                {pendingResults.map((p) => (
                  <div key={String(p.id)} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {p.match_title ?? p.match ?? `Prediction ${String(p.id)}`}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {p.league ?? "—"} • {p.match_date ? new Date(p.match_date).toLocaleString() : "—"}
                      </div>
                    </div>
                    <Link
                      href={`/admin/predictions?update=${encodeURIComponent(String(p.id))}`}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      Update Result
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
                No overdue pending results.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0D1320]">
          <CardHeader>
            <h2 className="text-base font-semibold">Recent signups</h2>
            <p className="mt-1 text-sm text-muted">Last 10 subscription records.</p>
          </CardHeader>
          <CardContent>
            {recentSignups.length ? (
              <div className="divide-y divide-border rounded-2xl border border-border bg-background/30">
                {recentSignups.map((s) => (
                  <div key={String(s.clerk_user_id ?? s.user_id)} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {String(s.clerk_user_id ?? s.user_id ?? "—")}
                      </div>
                      <Badge className="bg-white/5 text-white/80">{String(s.tier ?? "free").toUpperCase()}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
                No signups found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <h2 className="text-base font-semibold">Recent payments</h2>
          <p className="mt-1 text-sm text-muted">Last 10 payment rows.</p>
        </CardHeader>
        <CardContent>
          {recentPayments.length ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
              <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                <div className="col-span-4">User</div>
                <div className="col-span-2">Tier</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Created</div>
              </div>
              <div className="divide-y divide-border">
                {recentPayments.map((p, idx) => {
                  const status = String(p.status ?? "").toLowerCase();
                  return (
                    <div key={`${String(p.user_id ?? "u")}-${idx}`} className="grid grid-cols-12 px-4 py-3 text-sm">
                      <div className="col-span-4 truncate text-foreground">{String(p.user_id ?? "—")}</div>
                      <div className="col-span-2 text-muted">{String(p.tier ?? "—").toUpperCase()}</div>
                      <div className="col-span-2 text-muted">{formatMoney(Number(p.amount ?? 0))}</div>
                      <div className="col-span-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                            status === "success"
                              ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
                              : status === "failed"
                                ? "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
                                : "border-white/10 bg-white/[0.03] text-white/70",
                          )}
                        >
                          {String(p.status ?? "—").toUpperCase()}
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-muted">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
              No payments found (payments table may not be configured yet).
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

