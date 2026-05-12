import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface WelcomeEmailProps {
  username: string;
}

export default function WelcomeEmail({ username = 'User' }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to TipLytic - Your sports prediction journey begins!</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>Welcome to the club, {username}!</Heading>
            <Text style={theme.text}>
              We're thrilled to have you on board. TipLytic is your ultimate platform for tracking sports predictions, climbing the leaderboards, and building winning accumulators.
            </Text>
            <Text style={theme.text}>
              Your virtual bankroll has been loaded. Start submitting your picks, earn badges, and prove you're the best tipster in the community.
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard">
                Go to Dashboard
              </Button>
            </Section>
            <Hr style={theme.hr} />
            <Text style={theme.footerText}>
              Ready to make your first prediction? The community is waiting.
              <br />
              © {new Date().getFullYear()} TipLytic. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
