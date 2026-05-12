"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { cn } from "@/utils/cn";

type Interval = "monthly" | "annual";
type Tier = "free" | "basic" | "pro" | "elite";

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function monthlyPrice(tier: Tier) {
  if (tier === "basic") return 2500;
  if (tier === "pro") return 5000;
  if (tier === "elite") return 10000;
  return 0;
}

function price(tier: Tier, interval: Interval) {
  if (interval === "annual") {
    if (tier === "basic") return 25000;
    if (tier === "pro") return 50000;
    if (tier === "elite") return 100000;
    return 0;
  }
  return monthlyPrice(tier);
}

export default function Page() {
  const { userId } = useAuth();
  const sp = useSearchParams();
  const expired = sp.get("expired") === "true";
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);

  const tiers = useMemo(() => {
    return [
      {
        tier: "free" as const,
        name: "Free",
        badge: null,
        items: ["2 predictions/day", "Basic match info", "Community access"],
        cta: "Get Started Free",
      },
      {
        tier: "basic" as const,
        name: "Basic",
        badge: "7 DAYS FREE",
        items: ["5 predictions/day", "Odds and admin analysis", "Full leaderboard access"],
        cta: "Start 7-Day Trial",
      },
      {
        tier: "pro" as const,
        name: "Pro",
        badge: "MOST POPULAR",
        items: ["Unlimited predictions", "Confidence scores", "Full stats + export", "Follow tipsters"],
        cta: "Start 7-Day Trial",
      },
      {
        tier: "elite" as const,
        name: "Elite",
        badge: null,
        items: ["Everything in Pro", "VIP admin picks + WhatsApp alerts", "Verified Tipster eligibility", "Streak freeze (1/month)"],
        cta: "Subscribe",
      },
    ];
  }, []);

  async function start(tier: Tier) {
    if (!userId) {
      window.location.href = "/sign-in";
      return;
    }
    if (tier === "free") {
      window.location.href = "/dashboard";
      return;
    }

    setLoadingTier(tier);
    const res = await fetch("/api/payments/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier, interval, trial: tier === "basic" || tier === "pro" }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { redirectUrl?: string; authorizationUrl?: string; error?: string } | null;
    setLoadingTier(null);
    if (!res || !res.ok) {
      toast.error(json?.error || "Failed to start checkout");
      return;
    }
    window.location.href = json?.authorizationUrl || json?.redirectUrl || "/dashboard/subscription";
  }

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-accent">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Choose a plan
        </h1>
        <p className="mt-3 text-sm text-muted">
          Start free, upgrade when you want more picks and tools.
        </p>
      </div>

      {expired ? (
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/10 p-4 text-sm text-[#EF4444]">
          Your subscription has ended. Choose a plan to continue.
        </div>
      ) : null}

      <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setInterval("monthly")}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-semibold",
            interval === "monthly" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-border bg-card/50 text-foreground",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("annual")}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-semibold",
            interval === "annual" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-border bg-card/50 text-foreground",
          )}
        >
          Annual
        </button>
        {interval === "annual" ? (
          <span className="rounded-full border border-[#10B981]/25 bg-[#10B981]/10 px-3 py-1 text-xs font-medium text-[#10B981]">
            Save 2 months free
          </span>
        ) : null}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <Card key={t.name} className={t.name === "Pro" ? "border-accent/35" : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{t.name}</h2>
                {t.badge ? (
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    t.badge === "7 DAYS FREE" ? "border border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]" : "bg-accent-soft text-foreground",
                  )}>
                    {t.badge}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">
                  {formatMoney(price(t.tier, interval))}
                </span>
                <span className="pb-1 text-sm text-muted">
                  {t.tier === "free" ? "/month" : interval === "annual" ? "/year" : "/month"}
                </span>
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
                {t.tier === "free" ? (
                  <ButtonLink href={userId ? "/dashboard" : "/sign-up"} className="w-full" variant="secondary">
                    Get Started Free
                  </ButtonLink>
                ) : (
                  <button
                    type="button"
                    onClick={() => void start(t.tier)}
                    disabled={loadingTier === t.tier}
                    className={cn(
                      "inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-medium transition",
                      t.name === "Pro"
                        ? "bg-accent text-white hover:shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_28px_rgba(59,130,246,0.18)]"
                        : "border border-border bg-card/70 text-foreground hover:border-accent/35",
                      loadingTier === t.tier && "opacity-70",
                    )}
                  >
                    {loadingTier === t.tier ? "Starting…" : t.cta}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Container>
  );
}
