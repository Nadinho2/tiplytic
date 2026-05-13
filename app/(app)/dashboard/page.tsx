import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { StreakBadge } from "@/components/dashboard/StreakBadge";
import {
  getTierProgressLabel,
  getUserStats,
} from "@/lib/stats-engine";

const BankrollWidget = dynamic(
  () => import("@/components/dashboard/BankrollWidget").then((m) => m.BankrollWidget),
  {
    loading: () => (
      <div className="h-[340px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

const PerformanceChart = dynamic(
  () => import("@/components/dashboard/PerformanceChart").then((m) => m.PerformanceChart),
  {
    loading: () => (
      <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

const DailyChallenge = dynamic(
  () => import("@/components/challenges/DailyChallenge").then((m) => m.DailyChallenge),
  {
    loading: () => (
      <div className="h-[260px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

const BadgeGrid = dynamic(
  () => import("@/components/ui/BadgeGrid").then((m) => m.BadgeGrid),
  {
    loading: () => (
      <div className="h-[340px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

const PredictionHistoryTable = dynamic(
  () => import("@/components/dashboard/PredictionHistoryTable").then((m) => m.PredictionHistoryTable),
  {
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

const MyCommunityPredictionsTable = dynamic(
  () => import("@/components/dashboard/MyCommunityPredictionsTable").then((m) => m.MyCommunityPredictionsTable),
  {
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

const LeagueHeatmap = dynamic(
  () => import("@/components/dashboard/LeagueHeatmap").then((m) => m.LeagueHeatmap),
  {
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-2xl border border-border bg-white/5" />
    ),
  },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getTrialEndsInDaysFromClaims(claims: unknown) {
  if (!isRecord(claims)) return null;
  const publicMetadata = isRecord(claims.publicMetadata)
    ? claims.publicMetadata
    : isRecord(claims.public_metadata)
      ? claims.public_metadata
      : null;
  if (!publicMetadata) return null;
  const sub = isRecord(publicMetadata.subscription) ? publicMetadata.subscription : null;
  if (!sub) return null;

  const status = String(sub.status ?? "").toLowerCase();
  const trialEnd =
    typeof sub.trialEndsAt === "string"
      ? sub.trialEndsAt
      : typeof sub.trial_ends_at === "string"
        ? sub.trial_ends_at
        : null;
  const expiresAt =
    typeof sub.expiresAt === "string"
      ? sub.expiresAt
      : typeof sub.expires_at === "string"
        ? sub.expires_at
        : null;

  const end = trialEnd ?? (status === "trialing" ? expiresAt : null);
  if (status !== "trialing" || !end) return null;
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

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

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function Page() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const stats = await getUserStats(userId);

  let trialEndsInDays: number | null = getTrialEndsInDaysFromClaims(sessionClaims);
  if (trialEndsInDays === null) {
    const supabase = createServiceClient();
    try {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("status,trial_ends_at,expires_at")
        .eq("clerk_user_id", userId)
        .maybeSingle<{ status: string | null; trial_ends_at?: string | null; expires_at?: string | null }>();

      const status = String(data?.status ?? "").toLowerCase();
      const end = data?.trial_ends_at ?? (status === "trialing" ? (data?.expires_at ?? null) : null);
      if (status === "trialing" && end) {
        const diff = new Date(end).getTime() - Date.now();
        trialEndsInDays = Math.max(0, Math.ceil(diff / 86_400_000));
      }
    } catch {}
  }

  return (
    <Container className="space-y-6 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-accent">Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Your performance
              </h1>
              <p className="mt-2 text-sm text-muted">
                Stats based on your community predictions and bankroll activity.
              </p>
            </div>
            <Badge>
              {getTierProgressLabel(stats.tier, stats.nextTier, stats.progressToNext)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/20 p-4">
            <div className="text-sm text-muted">
              Want to share your picks and climb the leaderboard?
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/dashboard/community" variant="primary" size="sm">
                Submit a prediction
              </ButtonLink>
              <ButtonLink href="/dashboard/accumulator" variant="secondary" size="sm">
                Acca builder
              </ButtonLink>
            </div>
          </div>
          {typeof trialEndsInDays === "number" ? (
            <div className="mb-4 rounded-2xl border border-[#3B82F6]/25 bg-[#3B82F6]/10 p-4 text-sm text-[#3B82F6]">
              Trial ends in {trialEndsInDays} day{trialEndsInDays === 1 ? "" : "s"} — add payment to continue.
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">Total Predictions</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {stats.totalPredictions}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">Win Rate</div>
              <div className="mt-2 text-2xl font-semibold text-[#10B981]">
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
            <StreakBadge streak={stats.streak} />
            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">ROI</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {stats.roi.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">Virtual Bankroll</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatMoney(stats.bankrollBalance)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">Rank Badge</div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                {stats.tier.toUpperCase()}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${stats.progressToNext}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DailyChallenge />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">Badges</div>
          <p className="mt-1 text-sm text-muted">
            Earn achievements by predicting, building streaks, and growing your bankroll.
          </p>
        </CardHeader>
        <CardContent>
          <BadgeGrid />
        </CardContent>
      </Card>

      <BankrollWidget />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <div className="text-sm font-semibold text-foreground">
              Recent Activity
            </div>
            <p className="mt-1 text-sm text-muted">
              Last 10 community predictions.
            </p>
          </CardHeader>
          <CardContent>
            {stats.recent.length ? (
              <div className="space-y-3">
                {stats.recent.map((p) => (
                  <div
                    key={String(p.id)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/20 p-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.match ?? "—"}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {p.tip ?? "—"} • Odds {String(p.odds ?? "—")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          p.result === "win"
                            ? "rounded-full border border-[#10B981]/25 bg-[#10B981]/10 px-3 py-1 text-xs font-medium text-[#10B981]"
                            : p.result === "loss"
                              ? "rounded-full border border-[#EF4444]/25 bg-[#EF4444]/10 px-3 py-1 text-xs font-medium text-[#EF4444]"
                              : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted"
                        }
                      >
                        {String(p.result ?? "pending").toUpperCase()}
                      </span>
                      <div
                        className={
                          (p.profit_loss ?? 0) >= 0
                            ? "text-sm font-semibold text-[#10B981]"
                            : "text-sm font-semibold text-[#EF4444]"
                        }
                      >
                        {formatMoney(p.profit_loss ?? 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 p-6 text-center text-sm text-muted">
                No activity yet.
              </div>
            )}
          </CardContent>
        </Card>

        <PerformanceChart series={stats.bankrollSeries} />
      </div>

      <PredictionHistoryTable rows={stats.history} userTier={stats.tier} />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">My predictions</div>
          <p className="mt-1 text-sm text-muted">
            All community predictions you’ve submitted (includes optional reasoning and stake).
          </p>
        </CardHeader>
        <CardContent>
          <MyCommunityPredictionsTable />
        </CardContent>
      </Card>

      <LeagueHeatmap rows={stats.leagueBreakdown} />
    </Container>
  );
}
