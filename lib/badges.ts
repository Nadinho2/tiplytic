export const BADGES = {
  first_prediction: {
    key: "first_prediction",
    label: "Sharp Eye",
    emoji: "🎯",
    description: "Made your first prediction",
  },
  five_streak: {
    key: "five_streak",
    label: "On Fire",
    emoji: "🔥",
    description: "5 correct predictions in a row",
  },
  ten_streak: {
    key: "ten_streak",
    label: "Unstoppable",
    emoji: "⚡",
    description: "10 correct predictions in a row",
  },
  bold_pick: {
    key: "bold_pick",
    label: "Bold",
    emoji: "🦁",
    description: "Correct prediction at odds 3.00+",
  },
  fifty_predictions: {
    key: "fifty_predictions",
    label: "Committed",
    emoji: "📈",
    description: "50 predictions submitted",
  },
  double_bankroll: {
    key: "double_bankroll",
    label: "Double Up",
    emoji: "💰",
    description: "Doubled your virtual bankroll",
  },
  consistent: {
    key: "consistent",
    label: "Consistent",
    emoji: "📅",
    description: "Predicted 30 days in a row",
  },
  legend: {
    key: "legend",
    label: "Legend",
    emoji: "👑",
    description: "500 total predictions",
  },
  africa_giant: {
    key: "africa_giant",
    label: "African Giant",
    emoji: "🌍",
    description: "Reached top 10 leaderboard",
  },
  annual_member: {
    key: "annual_member",
    label: "Annual Member",
    emoji: "🗓️",
    description: "Subscribed on an annual plan",
  },
} as const;

export type BadgeKey = keyof typeof BADGES;

export const BADGE_LIST = Object.values(BADGES);
