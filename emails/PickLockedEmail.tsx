import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface PickLockedEmailProps {
  username: string;
  matchName: string;
  prediction: string;
}

export default function PickLockedEmail({ username = 'User', matchName = 'Arsenal vs Chelsea', prediction = 'Arsenal to Win' }: PickLockedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your pick for {matchName} is locked in!</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>Pick Locked 🔒</Heading>
            <Text style={theme.text}>
              Hi {username},
            </Text>
            <Text style={theme.text}>
              Kickoff is less than 30 minutes away. Your prediction has been officially locked and can no longer be edited or deleted.
            </Text>
            
            <Section style={theme.statBox}>
              <Text style={theme.statLabel}>{matchName}</Text>
              <Text style={theme.statValue}>{prediction}</Text>
            </Section>

            <Text style={theme.text}>
              The community consensus is now visible. Head over to the match page to see how the rest of the TipLytic community is betting. Good luck!
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard">
                View Match Consensus
              </Button>
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
