"use client";

import { useAuth, useUser as useClerkUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

import { createClientComponentClient } from "@/lib/supabase-client";

type SubscriptionTier = "free" | "basic" | "pro" | "elite";

type UserSubscription = {
  tier: SubscriptionTier;
  expires_at?: string | null;
};

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
          setUserSubscription(null);
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
  }, [getToken, isAuthLoaded, isUserLoaded, userId]);

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
