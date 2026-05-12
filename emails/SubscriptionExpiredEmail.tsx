import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface SubscriptionExpiredEmailProps {
  username: string;
}

export default function SubscriptionExpiredEmail({ username = 'User' }: SubscriptionExpiredEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your TipLytic Pro subscription has expired</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>Subscription Expired</Heading>
            <Text style={theme.text}>
              Hi {username},
            </Text>
            <Text style={theme.text}>
              Your TipLytic Pro subscription has officially expired. You've been downgraded to the free tier, which means you've lost access to advanced analytics, unlimited accumulator building, and the VIP community sections.
            </Text>
            <Text style={theme.text}>
              Don't lose your competitive edge. Reactivate your subscription today to get right back into the action.
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard/billing">
                Reactivate Pro
              </Button>
            </Section>
            <Hr style={theme.hr} />
            <Text style={theme.footerText}>
              We hope to see you back on the premium leaderboards soon!
              <br />
              © {new Date().getFullYear()} TipLytic. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
