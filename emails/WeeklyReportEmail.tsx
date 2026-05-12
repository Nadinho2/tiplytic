import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from "@react-email/components";
import * as React from "react";
import { theme } from "./theme";

type BestPick = {
  match: string;
  tip: string;
  odds: number;
};

type BestWorstLeague = {
  best: string;
  worst: string;
};

export type WeeklyReportEmailProps = {
  username: string;
  startLabel: string;
  endLabel: string;
  predictionsMade: number;
  wins: number;
  losses: number;
  winRate: number;
  bankrollChange: number;
  winRateDelta: number;
  streakLabel: string;
  bestPick: BestPick | null;
  leagueBreakdown: BestWorstLeague;
  rankDelta: number;
  fullStatsUrl: string;
  todaysPredictionsUrl: string;
};

function formatSigned(n: number) {
  const fixed = Math.round(n * 10) / 10;
  return `${fixed >= 0 ? "+" : ""}${fixed.toFixed(1)}`;
}

function formatMoneySigned(n: number) {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(abs);
  return `${n >= 0 ? "+" : "-"}${formatted}`;
}

function motivationalLine(winRate: number) {
  if (winRate > 60) return "Outstanding week. Keep it going.";
  if (winRate >= 50) return "Solid week. Consistency is everything.";
  return "Tough week — the data will come back around.";
}

export default function WeeklyReportEmail({
  username = "Tipster",
  startLabel = "May 06",
  endLabel = "May 12",
  predictionsMade = 0,
  wins = 0,
  losses = 0,
  winRate = 0,
  bankrollChange = 0,
  winRateDelta = 0,
  streakLabel = "—",
  bestPick = null,
  leagueBreakdown = { best: "—", worst: "—" },
  rankDelta = 0,
  fullStatsUrl = "https://tiplytic.com/dashboard",
  todaysPredictionsUrl = "https://tiplytic.com/predictions",
}: WeeklyReportEmailProps) {
  const deltaUp = winRateDelta > 0;
  const deltaDown = winRateDelta < 0;
  const deltaColor = deltaUp ? "#10B981" : deltaDown ? "#EF4444" : "#9CA3AF";
  const deltaArrow = deltaUp ? "▲" : deltaDown ? "▼" : "•";
  const bankrollColor = bankrollChange >= 0 ? "#10B981" : "#EF4444";
  const rankText =
    rankDelta > 0
      ? `You moved up ${rankDelta} positions on the leaderboard`
      : rankDelta < 0
        ? `You moved down ${Math.abs(rankDelta)} positions on the leaderboard`
        : "Your leaderboard position stayed the same";

  return (
    <Html>
      <Head />
      <Preview>{`Your Week in Review — ${startLabel} to ${endLabel}`}</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>{`Your Week in Review — ${startLabel} to ${endLabel}`}</Heading>
            <Text style={theme.text}>Hi {username}, here’s how your week played out.</Text>

            <Section style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Predictions</Text>
                <Text style={theme.statValue}>{predictionsMade}</Text>
              </Section>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Wins / Losses</Text>
                <Text style={theme.statValue}>
                  {wins} / {losses}
                </Text>
              </Section>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Win Rate</Text>
                <Text style={theme.statValue}>{winRate.toFixed(1)}%</Text>
              </Section>
            </Section>

            <Section style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Bankroll Change</Text>
                <Text style={{ ...theme.statValue, color: bankrollColor }}>
                  {formatMoneySigned(bankrollChange)}
                </Text>
              </Section>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Win Rate vs Last Week</Text>
                <Text style={{ ...theme.statValue, color: deltaColor }}>
                  {deltaArrow} {formatSigned(winRateDelta)}%
                </Text>
              </Section>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Current Streak</Text>
                <Text style={theme.statValue}>{streakLabel}</Text>
              </Section>
            </Section>

            <Section style={{ ...theme.statBox, textAlign: "left" }}>
              <Text style={{ ...theme.statLabel, marginBottom: "10px" }}>Best Prediction of the Week</Text>
              {bestPick ? (
                <>
                  <Text style={{ ...theme.text, marginBottom: "10px" }}>
                    <span style={theme.highlight}>{bestPick.match}</span>
                  </Text>
                  <Text style={{ ...theme.text, marginBottom: "0" }}>
                    {bestPick.tip} @ <span style={theme.highlight}>{bestPick.odds.toFixed(2)}</span>
                  </Text>
                </>
              ) : (
                <Text style={{ ...theme.text, marginBottom: "0" }}>No winning predictions this week.</Text>
              )}
            </Section>

            <Section style={{ ...theme.statBox, textAlign: "left" }}>
              <Text style={{ ...theme.statLabel, marginBottom: "10px" }}>Leagues Breakdown</Text>
              <Text style={{ ...theme.text, marginBottom: "8px" }}>
                Best league: <span style={theme.highlight}>{leagueBreakdown.best}</span>
              </Text>
              <Text style={{ ...theme.text, marginBottom: "0" }}>
                Worst league: <span style={theme.highlight}>{leagueBreakdown.worst}</span>
              </Text>
            </Section>

            <Section style={{ ...theme.statBox, textAlign: "left" }}>
              <Text style={{ ...theme.text, marginBottom: "0" }}>{rankText}</Text>
            </Section>

            <Section style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "28px" }}>
              <Button style={theme.button} href={fullStatsUrl}>
                See Full Stats
              </Button>
              <Button style={theme.button} href={todaysPredictionsUrl}>
                Today's Predictions
              </Button>
            </Section>

            <Hr style={theme.hr} />

            <Text style={{ ...theme.text, marginBottom: "0" }}>{motivationalLine(winRate)}</Text>
            <Text style={theme.footerText}>
              © {new Date().getFullYear()} TipLytic. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

