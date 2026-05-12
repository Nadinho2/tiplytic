import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from "@react-email/components";
import * as React from "react";
import { theme } from "./theme";

export type SubscriptionNoticeEmailProps = {
  preview: string;
  title: string;
  username: string;
  lines: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

export default function SubscriptionNoticeEmail({
  preview = "TipLytic subscription update",
  title = "Subscription update",
  username = "Tipster",
  lines = [],
  ctaLabel = null,
  ctaUrl = null,
}: SubscriptionNoticeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>{title}</Heading>
            <Text style={theme.text}>Hi {username},</Text>
            {lines.length ? (
              lines.map((l, idx) => (
                <Text key={idx} style={theme.text}>
                  {l}
                </Text>
              ))
            ) : (
              <Text style={theme.text}>—</Text>
            )}

            {ctaUrl && ctaLabel ? (
              <Section style={theme.buttonContainer}>
                <Button style={theme.button} href={ctaUrl}>
                  {ctaLabel}
                </Button>
              </Section>
            ) : null}

            <Hr style={theme.hr} />
            <Text style={theme.footerText}>© {new Date().getFullYear()} TipLytic. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

