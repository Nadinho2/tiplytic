import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { BADGES } from "@/lib/badges";
import { getEarnedBadges } from "@/lib/badge-checker";
import { calculateStreak } from "@/lib/stats-engine";
import { getTipsterRank } from "@/lib/tipster-ranks";
import { FollowButton } from "@/components/tipsters/FollowButton";
import { Badge as UiBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
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

function parseOdds(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMemberSince(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function streakLabel(v: number) {
  if (v === 0) return "—";
  return v > 0 ? `${v}W` : `${Math.abs(v)}L`;
}

function startOfWeekUtc(d: Date) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}

type PredictionRow = {
  id: string | number;
  created_at: string | null;
  match_title?: string | null;
  match?: string | null;
  league?: string | null;
  tip?: string | null;
  odds?: number | string | null;
  result?: string | null;
  profit_loss?: number | null;
  stake?: number | null;
  reasoning?: string | null;
};

function computeLeagueBreakdown(rows: PredictionRow[]) {
  const map = new Map<string, { league: string; total: number; wins: number; losses: number; winRate: number }>();
  for (const r of rows) {
    const league = r.league ?? "Others";
    const res = (r.result ?? "").toLowerCase();
    if (res !== "win" && res !== "loss") continue;
    const cur = map.get(league) ?? { league, total: 0, wins: 0, losses: 0, winRate: 0 };
    cur.total += 1;
    if (res === "win") cur.wins += 1;
    if (res === "loss") cur.losses += 1;
    cur.winRate = cur.total > 0 ? (cur.wins / cur.total) * 100 : 0;
    map.set(league, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.winRate - a.winRate);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { username: rawUsername } = await params;
  const handle = decodeURIComponent(rawUsername);
  const sp = (await searchParams) ?? {};

  type ClerkUser = {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt: number;
  };

  let user: ClerkUser | null = null;
  try {
    const clerk = await clerkClient();
    const list = (await clerk.users.getUserList({
      username: [handle],
      limit: 1,
    })) as unknown as { data: ClerkUser[] };
    user = Array.isArray(list.data) ? list.data[0] ?? null : null;
  } catch {}

  if (!user) {
    try {
      const clerk = await clerkClient();
      user = (await clerk.users.getUser(handle)) as unknown as ClerkUser;
    } catch {}
  }

  if (!user) notFound();

  const userId = String(user.id);
  const username =
    user.username ||
    [user.firstName, user.lastName].filter(Boolean).join("").toLowerCase() ||
    userId;

  const memberSince = typeof user.createdAt === "number" ? user.createdAt : Date.now();

  const supabase = createServiceClient();

  const { data: allRows } = await supabase
    .from("community_predictions")
    .select("id,created_at,match_title,match,league,tip,odds,result,profit_loss,stake,reasoning")
    .eq("user_id", userId)
    .gte("odds", 1.5)
    .order("created_at", { ascending: false })
    .limit(5000);

  const all =
    (allRows as PredictionRow[] | null)?.map((r) => ({
      ...r,
      odds: parseOdds(r.odds),
    })) ?? [];

  const decided = all.filter((r) => r.result === "win" || r.result === "loss");
  const wins = decided.filter((r) => r.result === "win").length;
  const losses = decided.filter((r) => r.result === "loss").length;
  const totalPicks = wins + losses;
  const winRate = totalPicks > 0 ? (wins / totalPicks) * 100 : 0;

  const staked = decided.reduce((sum, r) => sum + (r.stake ?? 0), 0);
  const profit = decided.reduce((sum, r) => sum + (r.profit_loss ?? 0), 0);
  const roi = staked > 0 ? (profit / staked) * 100 : 0;

  const streak = calculateStreak(
    decided.map((p, idx) => ({
      id: idx,
      user_id: userId,
      created_at: p.created_at,
      result: p.result,
    })),
  );

  const rank = getTipsterRank({ totalPicks, winRate, roi });
  const leagueBreakdown = computeLeagueBreakdown(all);

  const earned = await getEarnedBadges(userId);

  const weekStart = startOfWeekUtc(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const { data: weekRows } = await supabase
    .from("challenge_entries")
    .select("user_id,points_earned,created_at")
    .gte("created_at", weekStart.toISOString())
    .lt("created_at", weekEnd.toISOString())
    .limit(50_000);

  const scores = new Map<string, number>();
  for (const r of (weekRows as Array<{ user_id: string; points_earned: number | null }> | null) ?? []) {
    scores.set(r.user_id, (scores.get(r.user_id) ?? 0) + (r.points_earned ?? 0));
  }
  const top3 = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([uid]) => uid);
  const isWeeklyChampion = top3.includes(userId);

  const pageIndex = Math.max(0, Math.floor(Number(sp.page ?? "0")));
  const pageSize = 20;
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const { data: recentRows } = await supabase
    .from("community_predictions")
    .select("id,created_at,match_title,match,league,tip,odds,result,profit_loss,stake,reasoning")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const recent = (recentRows as PredictionRow[] | null) ?? [];
  const hasNext = recent.length === pageSize;

  return (
    <Container className="py-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Tipster Profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            @{username}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>Member since {formatMemberSince(memberSince)}</span>
            <span className="text-muted-2">•</span>
            <span
              className="inline-flex items-center rounded-full border border-border bg-background/30 px-3 py-1 text-xs font-medium text-foreground"
              style={{
                borderColor: `${rank.color}55`,
                backgroundColor: `${rank.color}1A`,
              }}
            >
              {rank.label}
            </span>
            {isWeeklyChampion ? (
              <>
                <span className="text-muted-2">•</span>
                <span className="inline-flex items-center rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                  🏆 Weekly Champion
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FollowButton targetUserId={userId} />
          <ButtonLink href="/tipsters" variant="secondary" size="sm">
            Back to leaderboard
          </ButtonLink>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-sm font-semibold text-foreground">Stats</div>
            <p className="mt-1 text-sm text-muted">
              Only odds 1.50+ are counted.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Total picks</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{totalPicks}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Win rate</div>
                <div className="mt-2 text-2xl font-semibold text-[#10B981]">{formatPercent(winRate)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">ROI</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(roi)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Best streak</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{streak.longest}W</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Current streak</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{streakLabel(streak.current)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-foreground">Badges</div>
            <p className="mt-1 text-sm text-muted">Earned badges only.</p>
          </CardHeader>
          <CardContent>
            {earned.length ? (
              <div className="grid grid-cols-2 gap-3">
                {earned.map((k) => {
                  const b = BADGES[k];
                  return (
                    <div
                      key={k}
                      className="rounded-2xl border border-border bg-background/20 p-3"
                      title={`${b.label} — ${b.description}`}
                    >
                      <div className="text-2xl">{b.emoji}</div>
                      <div className="mt-2 text-xs font-semibold text-foreground">{b.label}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
                No badges yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Recent predictions</div>
                <p className="mt-1 text-sm text-muted">Last 20 predictions.</p>
              </div>
              <div className="flex items-center gap-2">
                <ButtonLink
                  href={`/tipsters/${encodeURIComponent(username)}?page=${Math.max(0, pageIndex - 1)}`}
                  variant="secondary"
                  size="sm"
                  className={cn(pageIndex === 0 && "pointer-events-none opacity-50")}
                >
                  Prev
                </ButtonLink>
                <ButtonLink
                  href={`/tipsters/${encodeURIComponent(username)}?page=${pageIndex + 1}`}
                  variant="secondary"
                  size="sm"
                  className={cn(!hasNext && "pointer-events-none opacity-50")}
                >
                  Next
                </ButtonLink>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                <div className="col-span-5">Match</div>
                <div className="col-span-3">Tip</div>
                <div className="col-span-1 text-right">Odds</div>
                <div className="col-span-1 text-right">P&amp;L</div>
                <div className="col-span-2 text-right">Result</div>
              </div>
              <div className="divide-y divide-border bg-card/40">
                {recent.map((r) => {
                  const match = r.match_title ?? r.match ?? "—";
                  const res = String(r.result ?? "pending").toLowerCase();
                  const pl = r.profit_loss ?? 0;
                  return (
                    <div key={String(r.id)} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
                      <div className="col-span-5">
                        <div className="font-medium text-foreground">{match}</div>
                        {r.reasoning ? (
                          <div className="mt-1 text-xs text-muted">{r.reasoning}</div>
                        ) : null}
                      </div>
                      <div className="col-span-3 text-muted">{r.tip ?? "—"}</div>
                      <div className="col-span-1 text-right text-muted">{String(r.odds ?? "—")}</div>
                      <div className={cn("col-span-1 text-right font-semibold", pl >= 0 ? "text-[#10B981]" : "text-[#EF4444]")}>
                        {formatMoney(pl)}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <UiBadge
                          variant={res === "win" ? "success" : res === "loss" ? "danger" : "warning"}
                        >
                          {String(r.result ?? "pending").toUpperCase()}
                        </UiBadge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-foreground">League breakdown</div>
            <p className="mt-1 text-sm text-muted">Win rate by league.</p>
          </CardHeader>
          <CardContent>
            {leagueBreakdown.length ? (
              <div className="space-y-3">
                {leagueBreakdown.slice(0, 8).map((l) => (
                  <div key={l.league} className="rounded-2xl border border-border bg-background/20 p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold text-foreground">{l.league}</div>
                      <div className="text-xs text-muted">{l.total} picks</div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(0, Math.min(100, l.winRate))}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted">{formatPercent(l.winRate)} win rate</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
                No league stats yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-xs text-muted">
        <Link href="/terms" className="hover:text-foreground hover:underline">
          Terms
        </Link>
      </div>
    </Container>
  );
}
