export const RANKS = [
  {
    key: "beginner",
    label: "Beginner",
    min_predictions: 0,
    min_win_rate: 0,
    color: "#94A3B8",
  },
  {
    key: "bronze",
    label: "Bronze",
    min_predictions: 10,
    min_win_rate: 45,
    color: "#CD7F32",
  },
  {
    key: "silver",
    label: "Silver",
    min_predictions: 30,
    min_win_rate: 52,
    color: "#C0C0C0",
  },
  {
    key: "gold",
    label: "Gold",
    min_predictions: 60,
    min_win_rate: 58,
    color: "#FFD700",
  },
  {
    key: "elite",
    label: "Elite Tipster",
    min_predictions: 100,
    min_win_rate: 63,
    min_roi: 15,
    color: "#3B82F6",
  },
] as const;

export type RankKey = (typeof RANKS)[number]["key"];

export type RankStats = {
  totalPicks: number;
  winRate: number;
  roi: number;
};

export function getTipsterRank(stats: RankStats) {
  const ordered = RANKS.slice().sort(
    (a, b) => b.min_predictions - a.min_predictions,
  );

  for (const r of ordered) {
    const okPreds = stats.totalPicks >= r.min_predictions;
    const okWr = stats.winRate >= r.min_win_rate;
    const okRoi =
      typeof (r as { min_roi?: number }).min_roi === "number"
        ? stats.roi >= (r as { min_roi: number }).min_roi
        : true;

    if (okPreds && okWr && okRoi) return r;
  }

  return RANKS[0];
}
