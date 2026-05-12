export const TIER_HIERARCHY = {
  free: 0,
  basic: 1,
  pro: 2,
  elite: 3,
} as const;

export type Tier = keyof typeof TIER_HIERARCHY;

function normalizeTier(value: string): Tier {
  const v = value.toLowerCase();
  if (v === "elite") return "elite";
  if (v === "pro") return "pro";
  if (v === "basic") return "basic";
  return "free";
}

export function canAccessTier(userTier: string, requiredTier: string): boolean {
  const user = normalizeTier(userTier);
  const required = normalizeTier(requiredTier);
  return TIER_HIERARCHY[user] >= TIER_HIERARCHY[required];
}

export function getDailyPredictionLimit(tier: string): number {
  const t = normalizeTier(tier);
  if (t === "free") return 2;
  if (t === "basic") return 5;
  return Number.POSITIVE_INFINITY;
}

export function canSeeConfidenceScore(tier: string): boolean {
  const t = normalizeTier(tier);
  return t === "pro" || t === "elite";
}

export function canSeeAdminAnalysis(tier: string): boolean {
  return canAccessTier(tier, "basic");
}

export function canSubmitCommunityPredictions(): boolean {
  return true;
}

export function canFollowTipsters(tier: string): boolean {
  return canAccessTier(tier, "pro");
}

export function canAccessLeaderboard(tier: string): "top10" | "full" {
  return canAccessTier(tier, "pro") ? "full" : "top10";
}
