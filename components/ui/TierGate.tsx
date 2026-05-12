"use client";

import { Lock } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { canAccessTier } from "@/lib/tier-access";

export function TierGate({
  requiredTier,
  children,
}: {
  requiredTier: string;
  children: React.ReactNode;
}) {
  const { userSubscription, isLoading } = useUser();
  const userTier = userSubscription?.tier ?? "free";

  if (isLoading || canAccessTier(userTier, requiredTier)) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-[6px]">{children}</div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-background/80 p-4 text-center backdrop-blur">
          <div className="mx-auto grid size-10 place-items-center rounded-xl border border-border bg-card/70 text-muted">
            <Lock className="size-5" />
          </div>
          <div className="mt-3 text-sm font-semibold text-foreground">
            This feature requires {requiredTier} or above
          </div>
          <div className="mt-4">
            <ButtonLink href="/pricing" variant="primary" className="w-full">
              Upgrade Now
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
