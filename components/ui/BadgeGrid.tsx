"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";

import { BADGE_LIST, type BadgeKey, BADGES } from "@/lib/badges";
import { cn } from "@/utils/cn";

type ApiResponse = {
  earned?: BadgeKey[];
  newlyAwarded?: BadgeKey[];
};

type Toast = { id: string; message: string };

export function BadgeGrid({
  className,
  awardOnMount = true,
}: {
  className?: string;
  awardOnMount?: boolean;
}) {
  const [earned, setEarned] = useState<BadgeKey[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const earnedSet = useMemo(() => new Set(earned), [earned]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const qs = awardOnMount ? "?award=1" : "";
      const res = await fetch(`/api/badges${qs}`, { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as ApiResponse;
      if (cancelled) return;

      const nextEarned = (json.earned ?? []).filter((k) => k in BADGES);
      setEarned(nextEarned);

      const newly = (json.newlyAwarded ?? []).filter((k) => k in BADGES);
      if (newly.length) {
        const nextHighlight = new Set<string>();
        for (const k of newly) nextHighlight.add(k);
        setHighlight(nextHighlight);

        const nextToasts: Toast[] = newly.map((k) => ({
          id: `${k}-${Date.now()}`,
          message: `${BADGES[k].emoji} New badge unlocked: ${BADGES[k].label}!`,
        }));
        setToasts((prev) => [...prev, ...nextToasts]);

        for (const t of nextToasts) {
          window.setTimeout(() => {
            setToasts((prev) => prev.filter((p) => p.id !== t.id));
          }, 4_000);
        }

        window.setTimeout(() => setHighlight(new Set()), 2_000);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [awardOnMount]);

  return (
    <div className={cn("relative", className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {BADGE_LIST.map((badge) => {
          const isEarned = earnedSet.has(badge.key);
          const isNew = highlight.has(badge.key);
          const title = isEarned
            ? `${badge.label} — ${badge.description}`
            : `Locked — ${badge.description}`;

          return (
            <div
              key={badge.key}
              title={title}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border bg-card/70 p-4",
                isEarned ? "text-foreground" : "opacity-50 grayscale",
                isNew ? "[animation:badgePop_600ms_ease-out]" : undefined,
              )}
            >
              {!isEarned ? (
                <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-muted">
                  <Lock className="size-4" />
                </div>
              ) : null}
              <div className="text-3xl leading-none">{badge.emoji}</div>
              <div className="mt-3 text-sm font-semibold">{badge.label}</div>
              <div className="mt-1 text-xs text-muted">{badge.description}</div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-2xl border border-border bg-card/90 px-4 py-3 text-sm text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.45)] [animation:toastSlide_250ms_ease-out]"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
