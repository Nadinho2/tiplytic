import { auth } from "@clerk/nextjs/server";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const rows = [
  { rank: 1, name: "NeonEdge", roi: "+12.4%", winRate: "58.1%", picks: 214 },
  { rank: 2, name: "GreenPulse", roi: "+10.7%", winRate: "56.3%", picks: 192 },
  { rank: 3, name: "UnitCraft", roi: "+9.9%", winRate: "55.4%", picks: 241 },
  { rank: 4, name: "TapeRoom", roi: "+8.6%", winRate: "54.2%", picks: 177 },
  { rank: 5, name: "SharpZinc", roi: "+7.8%", winRate: "53.9%", picks: 268 },
];

export async function Leaderboard() {
  const { userId } = await auth();
  const ctaHref = userId ? "/dashboard/community" : "/sign-up";
  const ctaLabel = userId ? "Open community" : "Claim your profile";
  const rankHref = userId ? "/dashboard/community" : "/sign-up";
  const rankLabel = userId ? "See leaderboard" : "Join and get ranked";

  return (
    <section id="leaderboard">
      <Container className="py-14 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-accent">Leaderboard</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tipsters ranked by performance
            </h2>
            <p className="mt-4 text-base text-muted">
              Compare ROI, win rate, and sample size so the leaderboard stays fair.
            </p>
            <p className="mt-3 text-sm text-muted">
              Only odds of 1.5+ are counted, and tipsters need 10+ predicted games to appear.
            </p>
          </div>
          <ButtonLink href={ctaHref} variant="primary">
            {ctaLabel}
          </ButtonLink>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Top this month</h3>
                <Badge>Preview</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Placeholder rankings until Supabase data is connected.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-5">Tipster</div>
                  <div className="col-span-2 text-right">ROI</div>
                  <div className="col-span-3 text-right">Win rate</div>
                  <div className="col-span-2 text-right">Picks</div>
                </div>
                <div className="divide-y divide-border bg-card/40">
                  {rows.map((r) => (
                    <div
                      key={r.rank}
                      className="grid grid-cols-12 items-center px-4 py-3 text-sm"
                    >
                      <div className="col-span-5 flex items-center gap-3">
                        <span className="grid size-7 place-items-center rounded-xl bg-white/5 text-xs text-muted">
                          {r.rank}
                        </span>
                        <span className="font-medium">@{r.name}</span>
                      </div>
                      <div className="col-span-2 text-right font-medium text-accent">
                        {r.roi}
                      </div>
                      <div className="col-span-3 text-right text-muted">
                        {r.winRate}
                      </div>
                      <div className="col-span-2 text-right text-muted">
                        {r.picks}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold">What we rank on</h3>
              <p className="mt-1 text-sm text-muted">
                Metrics designed to reduce noise and reward consistency.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted">
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-accent" />
                  <span>ROI with sample-size awareness</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-accent" />
                  <span>Only odds of 1.5+ count</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-accent" />
                  <span>Units tracked over time</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-accent" />
                  <span>10+ predicted games required</span>
                </li>
              </ul>
              <div className="mt-6">
                <ButtonLink href={rankHref} variant="secondary" className="w-full">
                  {rankLabel}
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </section>
  );
}
