import { auth } from "@clerk/nextjs/server";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function Hero() {
  const { userId } = await auth();
  const primaryHref = userId ? "/dashboard" : "/sign-up";
  const primaryLabel = userId ? "Go to dashboard" : "Join the community";

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-240px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,255,136,0.18),rgba(0,255,136,0)_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),rgba(255,255,255,0)_55%)]" />
      </div>
      <Container className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <Badge>Community picks • Verified tracking • Neon-fast UI</Badge>
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Smart Betting Tips & Community Predictions
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted sm:text-lg">
            Follow top tipsters, compare records, and track your own picks in units
            with a clean, honest scoreboard.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={primaryHref} variant="primary">
              {primaryLabel}
            </ButtonLink>
            <ButtonLink href="/#community" variant="secondary">
              See today’s picks
            </ButtonLink>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <div className="text-xs text-muted">Today’s community picks</div>
              <div className="mt-1 text-lg font-semibold">Live preview</div>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <div className="text-xs text-muted">Track in units</div>
              <div className="mt-1 text-lg font-semibold">Win rate + ROI</div>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <div className="text-xs text-muted">Leaderboards</div>
              <div className="mt-1 text-lg font-semibold">Top tipsters</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
