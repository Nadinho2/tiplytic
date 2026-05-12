"use client";

import { ButtonLink } from "@/components/ui/button";

export function UpgradeBanner({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-foreground">
          You&apos;ve seen your 2 free predictions today. Upgrade to Basic for 5
          daily picks →
        </div>
        <ButtonLink href="/pricing" variant="primary" size="sm">
          Upgrade
        </ButtonLink>
      </div>
    </div>
  );
}
