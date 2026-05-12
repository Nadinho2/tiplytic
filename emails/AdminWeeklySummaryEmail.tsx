import { Html, Head, Body, Container, Section, Text, Heading, Hr, Preview } from "@react-email/components";
import * as React from "react";
import { theme } from "./theme";

export type AdminWeeklySummaryEmailProps = {
  startLabel: string;
  endLabel: string;
  newSubscribers: number;
  churnedSubscribers: number;
  activeByTier: Array<{ tier: string; count: number }>;
  revenueLabel: string;
  topTipsterLabel: string;
  platformWinRate: number;
  decidedPredictions: number;
};

export default function AdminWeeklySummaryEmail({
  startLabel = "May 06",
  endLabel = "May 12",
  newSubscribers = 0,
  churnedSubscribers = 0,
  activeByTier = [],
  revenueLabel = "—",
  topTipsterLabel = "—",
  platformWinRate = 0,
  decidedPredictions = 0,
}: AdminWeeklySummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`TipLytic Admin Weekly Summary — ${startLabel} to ${endLabel}`}</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>{`Admin Weekly Summary — ${startLabel} to ${endLabel}`}</Heading>

            <Section style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>New Subscribers</Text>
                <Text style={theme.statValue}>{newSubscribers}</Text>
              </Section>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Churned</Text>
                <Text style={theme.statValue}>{churnedSubscribers}</Text>
              </Section>
              <Section style={{ ...theme.statBox, flex: "1", margin: "0 5px" }}>
                <Text style={theme.statLabel}>Revenue</Text>
                <Text style={theme.statValue}>{revenueLabel}</Text>
              </Section>
            </Section>

            <Section style={{ ...theme.statBox, textAlign: "left" }}>
              <Text style={{ ...theme.statLabel, marginBottom: "10px" }}>Active by Tier</Text>
              {activeByTier.length ? (
                activeByTier.map((t) => (
                  <Text key={t.tier} style={{ ...theme.text, marginBottom: "8px" }}>
                    <span style={theme.highlight}>{t.tier}</span>: {t.count}
                  </Text>
                ))
              ) : (
                <Text style={{ ...theme.text, marginBottom: "0" }}>—</Text>
              )}
            </Section>

            <Section style={{ ...theme.statBox, textAlign: "left" }}>
              <Text style={{ ...theme.statLabel, marginBottom: "10px" }}>Top Performing Community Tipster</Text>
              <Text style={{ ...theme.text, marginBottom: "0" }}>
                <span style={theme.highlight}>{topTipsterLabel}</span>
              </Text>
            </Section>

            <Section style={{ ...theme.statBox, textAlign: "left" }}>
              <Text style={{ ...theme.statLabel, marginBottom: "10px" }}>Platform Win Rate (Week)</Text>
              <Text style={{ ...theme.text, marginBottom: "0" }}>
                <span style={theme.highlight}>{platformWinRate.toFixed(1)}%</span> across{" "}
                <span style={theme.highlight}>{decidedPredictions}</span> decided predictions
              </Text>
            </Section>

            <Hr style={theme.hr} />
            <Text style={theme.footerText}>
              © {new Date().getFullYear()} TipLytic. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

