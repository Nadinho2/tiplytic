"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";

export function FollowButton({
  targetUserId,
}: {
  targetUserId: string;
}) {
  const { isPro, isElite, isLoading, user } = useUser();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFollow = isPro || isElite;

  if (isLoading) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled>
        Follow
      </Button>
    );
  }

  if (!user) {
    return (
      <ButtonLink href="/sign-in" variant="secondary" size="sm">
        Sign in to follow
      </ButtonLink>
    );
  }

  if (!canFollow) {
    return (
      <ButtonLink href="/pricing" variant="secondary" size="sm">
        Pro/Elite to follow
      </ButtonLink>
    );
  }

  async function toggle() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: following ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; following?: boolean };
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        return;
      }
      setFollowing(Boolean(json.following));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant={following ? "secondary" : "primary"} size="sm" onClick={toggle} disabled={loading}>
        {loading ? "…" : following ? "Following" : "Follow"}
      </Button>
      {error ? <div className="text-xs text-red-200">{error}</div> : null}
    </div>
  );
}
