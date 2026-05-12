import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const features = [
  {
    title: "Verified records",
    description:
      "Track picks with clear timestamps, odds, and results. No vague claims, just performance.",
  },
  {
    title: "Community consensus",
    description:
      "See what the community is backing and follow tipsters you trust.",
  },
  {
    title: "Units + bankroll discipline",
    description:
      "Log picks in units, monitor streaks, and keep your strategy consistent.",
  },
  {
    title: "Smart analysis",
    description:
      "Filter by sport, odds, confidence, and performance. Find what actually works.",
  },
  {
    title: "Profiles + leaderboards",
    description:
      "Compare tipsters by ROI, win rate, and sample size for a fair scoreboard.",
  },
  {
    title: "Secure sign-in",
    description:
      "Clerk authentication with email and social providers to keep accounts protected.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-y border-border bg-white/[0.02]">
      <Container className="py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-accent">Built for bettors</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            A community that rewards accuracy
          </h2>
          <p className="mt-4 text-base text-muted">
            Follow picks, verify results, and track your own performance with a
            clean scoreboard.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <h3 className="text-base font-semibold">{f.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
