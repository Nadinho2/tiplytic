import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface BankrollWarningEmailProps {
  username: string;
  currentBalance: number;
}

export default function BankrollWarningEmail({ username = 'User', currentBalance = 50 }: BankrollWarningEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Warning: Your virtual bankroll is running low.</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>Low Bankroll Alert ⚠️</Heading>
            <Text style={theme.text}>
              Heads up, {username}. Your virtual bankroll has dropped below the critical threshold.
            </Text>
            
            <Section style={{...theme.statBox, borderColor: '#EF4444'}}>
              <Text style={theme.statLabel}>Current Balance</Text>
              <Text style={{...theme.statValue, color: '#EF4444'}}>₮{currentBalance.toFixed(2)}</Text>
            </Section>

            <Text style={theme.text}>
              Don&apos;t worry! You can still submit predictions to rebuild your stack, but you&apos;ll need to be careful with your stakes. Focus on high-confidence singles to get back in the green.
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard">
                Manage Bankroll
              </Button>
            </Section>
            <Hr style={theme.hr} />
            <Text style={theme.footerText}>
              Note: If your bankroll hits 0, it will automatically reset to ₮100 the following week.
              <br /><br />
              © {new Date().getFullYear()} TipLytic. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
