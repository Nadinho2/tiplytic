import { auth } from "@clerk/nextjs/server";

import { createServerComponentClient } from "@/lib/supabase";
import { AdminPickStats } from "@/components/predictions/AdminPickStats";
import { DailyChallenge } from "@/components/challenges/DailyChallenge";
import { GlobalWinRateTicker } from "@/components/marketing/GlobalWinRateTicker";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

async function getHomeStats() {
  const supabase = await createServerComponentClient();
  let totalPredictions = 0;
  let wonPredictions = 0;
  let lostPredictions = 0;
  let activeSubscribers = 0;

  try {
    const { data } = await supabase.rpc("get_global_stats");
    const json = data as
      | {
          total_predictions?: number;
          win_rate?: number;
          active_subscribers?: number;
        }
      | null;
    if (json) {
      return {
        totalPredictions: Number(json.total_predictions ?? 0),
        winRate: Number(json.win_rate ?? 0),
        activeSubscribers: Number(json.active_subscribers ?? 0),
      };
    }
  } catch {}

  try {
    const { count } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true });
    totalPredictions = count ?? 0;
  } catch {}

  try {
    const { count } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("result", "win");
    wonPredictions = count ?? 0;
  } catch {}

  try {
    const { count } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("result", "loss");
    lostPredictions = count ?? 0;
  } catch {}

  try {
    const { count } = await supabase
      .from("user_subscriptions")
      .select("*", { count: "exact", head: true })
      .neq("tier", "free");
    activeSubscribers = count ?? 0;
  } catch {}

  const denom = wonPredictions + lostPredictions;
  const winRate = denom > 0 ? (wonPredictions / denom) * 100 : 0;

  return {
    totalPredictions,
    winRate,
    activeSubscribers,
  };
}

export default async function Page() {
  const { userId } = await auth();
  const stats = await getHomeStats();
  const primaryHref = userId ? "/dashboard" : "/sign-up";
  const primaryLabel = userId ? "Dashboard" : "Get Started Free";
  return (
    <div className="bg-background">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-texture opacity-[0.18]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),rgba(59,130,246,0)_55%)]" />

        <Container className="py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Sports Predictions Powered by Data
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted sm:text-lg">
              Accurate match analysis for serious bettors
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href={primaryHref} variant="primary">
                {primaryLabel}
              </ButtonLink>
              <ButtonLink href="/predictions" variant="secondary">
                View Today&apos;s Picks
              </ButtonLink>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-5xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <div className="text-xs text-muted">Total predictions made</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {stats.totalPredictions}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <div className="text-xs text-muted">Win rate</div>
                <div className="mt-2 text-2xl font-semibold text-[#10B981]">
                  {Math.round(stats.winRate * 10) / 10}%
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <div className="text-xs text-muted">Active subscribers</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {stats.activeSubscribers}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <GlobalWinRateTicker />
            </div>

            <div className="mt-4">
              <DailyChallenge />
            </div>

            <AdminPickStats />

            <div className="mt-6">
              <Card className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Admin Pick Preview</h2>
                    <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted">
                      Today
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    A quick teaser of what premium picks look like.
                  </p>
                </CardHeader>
                <CardContent>
                  <div
                    className={
                      userId
                        ? "rounded-2xl border border-border bg-background/30 p-4"
                        : "rounded-2xl border border-border bg-background/30 p-4 blur-[6px]"
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          Man City vs Arsenal
                        </div>
                        <div className="mt-1 text-sm text-muted">
                          Market: Over/Under • Pick: Over 2.5 • Odds: 1.72
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted">
                        Confidence: High
                      </span>
                    </div>
                  </div>

                  {userId ? null : (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground backdrop-blur">
                        Sign in to view full pick details
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
