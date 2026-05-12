import { Html, Head, Body, Container, Section, Text, Heading, Hr, Preview, Link } from "@react-email/components";
import * as React from "react";
import { theme } from "./theme";

export type BroadcastEmailProps = {
  subject: string;
  body: string;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
};

function lines(body: string) {
  return body
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
}

export default function BroadcastEmail({
  subject = "TipLytic update",
  body = "",
  ctaUrl = null,
  ctaLabel = null,
}: BroadcastEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>{subject}</Heading>

            {lines(body).length ? (
              lines(body).map((l, idx) => (
                <Text key={idx} style={theme.text}>
                  {l}
                </Text>
              ))
            ) : (
              <Text style={theme.text}>—</Text>
            )}

            {ctaUrl && ctaLabel ? (
              <>
                <Hr style={theme.hr} />
                <Text style={theme.text}>
                  <Link href={ctaUrl} style={{ color: "#3B82F6", fontWeight: 700 }}>
                    {ctaLabel}
                  </Link>
                </Text>
              </>
            ) : null}

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

