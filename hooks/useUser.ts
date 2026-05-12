"use client";

import { useAuth, useUser as useClerkUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

type SubscriptionTier = "free" | "basic" | "pro" | "elite";

type UserSubscription = {
  tier: SubscriptionTier;
  expires_at?: string | null;
};

function normalizeTier(value: unknown): SubscriptionTier {
  const t = String(value ?? "").toLowerCase();
  if (t === "elite") return "elite";
  if (t === "pro") return "pro";
  if (t === "basic") return "basic";
  return "free";
}

function subscriptionFromPublicMetadata(publicMetadata: unknown): UserSubscription | null {
  const meta = publicMetadata as Record<string, unknown> | null;
  if (!meta || typeof meta !== "object") return null;
  const sub = meta.subscription as Record<string, unknown> | null;
  if (!sub || typeof sub !== "object") return null;
  const tier = normalizeTier(sub.tier);
  const expires_at =
    typeof sub.expiresAt === "string"
      ? sub.expiresAt
      : typeof sub.expires_at === "string"
        ? sub.expires_at
        : null;
  return { tier, expires_at };
}

export function useUser() {
  const { user, isLoaded: isUserLoaded } = useClerkUser();
  const { userId, isLoaded: isAuthLoaded } = useAuth();

  const [userSubscription, setUserSubscription] =
    useState<UserSubscription | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoaded || !isAuthLoaded) return;

    let cancelled = false;

    async function load() {
      if (!userId) {
        setUserSubscription(null);
        return;
      }

      setIsSubscriptionLoading(true);
      try {
        const res = await fetch("/api/subscriptions/status", { method: "GET", cache: "no-store" }).catch(
          () => null,
        );
        const json = (await res?.json().catch(() => null)) as
          | { tier?: string | null; expires_at?: string | null; error?: string }
          | null;

        if (cancelled) return;
        if (!res || !res.ok || !json) {
          const fallback = subscriptionFromPublicMetadata(user?.publicMetadata);
          setUserSubscription(fallback);
          return;
        }

        setUserSubscription({
          tier: normalizeTier(json.tier),
          expires_at: typeof json.expires_at === "string" ? json.expires_at : null,
        });
      } finally {
        if (!cancelled) setIsSubscriptionLoading(false);
      }
    }

    void load();

    const interval = setInterval(() => {
      void load();
    }, 30_000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthLoaded, isUserLoaded, userId, user?.publicMetadata]);

  const tier = userSubscription?.tier ?? "free";

  const helpers = useMemo(() => {
    return {
      isFree: tier === "free",
      isBasic: tier === "basic",
      isPro: tier === "pro",
      isElite: tier === "elite",
    };
  }, [tier]);

  return {
    user,
    userSubscription,
    isLoading: !isUserLoaded || !isAuthLoaded || isSubscriptionLoading,
    ...helpers,
  };
}
