import { auth } from "@clerk/nextjs/server";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const tiers = [
  {
    name: "Free",
    price: "₦0",
    note: "Free forever",
    items: ["See 1 prediction per day", "Browse the community", "Basic dashboard"],
  },
  {
    name: "Pro Tipster",
    price: "₦4,999",
    note: "Per month",
    items: [
      "See all predictions per day",
      "Ability to be a tipster",
      "Leaderboards + advanced analytics",
    ],
  },
  {
    name: "Elite Tipster",
    price: "₦9,999",
    note: "Per month",
    items: [
      "Everything in Pro Tipster",
      "Potential to earn commissions",
      "Commission based on winning percentage",
    ],
  },
];

export async function PricingTeaser() {
  const { userId } = await auth();

  return (
    <section id="pricing">
      <Container className="py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-accent">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Start free, upgrade when you’re ready
          </h2>
          <p className="mt-4 text-base text-muted">
            Three subscriptions in Naira, built for casual bettors, serious tipsters, and teams.
          </p>
          <p className="mt-3 text-sm text-muted">
            Leaderboard eligibility: only picks with odds of 1.5+ and tipsters with 10+ predicted games.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <Card
              key={t.name}
              className={t.name === "Pro Tipster" ? "border-accent/35" : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{t.name}</h3>
                  {t.name === "Pro Tipster" ? (
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-foreground">
                      Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {t.price}
                  </span>
                  <span className="pb-1 text-sm text-muted">{t.note}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted">
                  {t.items.map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 rounded-full bg-accent" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <ButtonLink
                    href={userId ? "/dashboard/settings" : "/sign-up"}
                    variant={t.name === "Pro Tipster" ? "primary" : "secondary"}
                    className="w-full"
                  >
                    {userId ? "Manage plan" : "Choose plan"}
                  </ButtonLink>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
