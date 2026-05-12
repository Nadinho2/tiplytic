"use client";

import { useAuth, useUser as useClerkUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

import { createClientComponentClient } from "@/lib/supabase-client";

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
  const { userId, getToken, isLoaded: isAuthLoaded } = useAuth();

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
        const accessToken = await getToken({ template: "supabase" }).catch(
          () => null,
        );
        const supabase = createClientComponentClient({
          accessToken: accessToken ?? undefined,
        });

        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("tier, expires_at")
          .eq("clerk_user_id", userId)
          .maybeSingle<UserSubscription>();

        if (cancelled) return;
        if (error) {
          const fallback = subscriptionFromPublicMetadata(user?.publicMetadata);
          setUserSubscription(fallback);
          return;
        }

        setUserSubscription(data ?? null);
      } finally {
        if (!cancelled) setIsSubscriptionLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [getToken, isAuthLoaded, isUserLoaded, userId, user?.publicMetadata]);

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
