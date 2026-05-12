import { auth } from "@clerk/nextjs/server";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const picks = [
  {
    match: "LAL vs BOS",
    market: "Spread",
    pick: "BOS -2.5",
    odds: "-110",
    tipster: "NeonEdge",
    confidence: "High",
  },
  {
    match: "MCI vs LIV",
    market: "Total",
    pick: "Over 2.5",
    odds: "-125",
    tipster: "GreenPulse",
    confidence: "Medium",
  },
  {
    match: "NYR vs TOR",
    market: "ML",
    pick: "NYR ML",
    odds: "+135",
    tipster: "UnitCraft",
    confidence: "Medium",
  },
  {
    match: "UFC Main Event",
    market: "Prop",
    pick: "Fight ends R3+",
    odds: "+120",
    tipster: "TapeRoom",
    confidence: "High",
  },
];

const results = [
  { label: "Today’s picks tracked", value: "128" },
  { label: "Community win rate (30d)", value: "54.7%" },
  { label: "Tipsters on leaderboard", value: "312" },
  { label: "Picks with verified results", value: "8.4k" },
];

export async function CommunityPreview() {
  const { userId } = await auth();

  return (
    <section id="community" className="border-y border-border bg-white/[0.02]">
      <Container className="py-14 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-accent">Community</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              A real betting community, not screenshots
            </h2>
            <p className="mt-4 text-base text-muted">
              Explore picks, tipster records, and results in one place. Track your
              own performance and learn what’s working right now.
            </p>
          </div>
          <div className="flex gap-3">
            <ButtonLink href="/dashboard" variant="secondary">
              View dashboard
            </ButtonLink>
            {userId ? null : (
              <ButtonLink href="/sign-up" variant="primary">
                Join free
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {results.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card/70 p-4"
            >
              <div className="text-xs text-muted">{s.label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Live picks feed</h3>
                <Badge>Preview</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Browse recent picks with markets, odds, and confidence.
              </p>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-2xl border border-border bg-background/30">
                {picks.map((p) => (
                  <div
                    key={`${p.match}-${p.pick}-${p.tipster}`}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {p.match} · {p.market}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        <span className="text-foreground">{p.pick}</span>{" "}
                        <span className="text-muted">({p.odds})</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs text-muted">@{p.tipster}</span>
                      <span className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-foreground">
                        {p.confidence}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted">
                Picks shown are placeholders. Live community feeds and verified
                results will be enabled in the next phase.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold">How TipLytic works</h3>
              <p className="mt-1 text-sm text-muted">
                Simple steps to keep picks honest and performance visible.
              </p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted">
                <li className="flex gap-3">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-zinc-950">
                    1
                  </span>
                  <span>
                    Post a pick with market, odds, and unit size.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-zinc-950">
                    2
                  </span>
                  <span>
                    Results are tracked and reflected in your profile record.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-zinc-950">
                    3
                  </span>
                  <span>
                    Climb the leaderboard with ROI, win rate, and sample size.
                  </span>
                </li>
              </ol>
              <div className="mt-6 rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted">
                TipLytic is built to help you track and learn. Always bet
                responsibly.
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </section>
  );
}
