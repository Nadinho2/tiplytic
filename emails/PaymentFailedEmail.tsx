import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface PaymentFailedEmailProps {
  username: string;
  amount: string;
  lastFour: string;
}

export default function PaymentFailedEmail({ username = 'User', amount = '$10.00', lastFour = '1234' }: PaymentFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Action Required: Payment Failed for TipLytic</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>Payment Failed</Heading>
            <Text style={theme.text}>
              Hi {username},
            </Text>
            <Text style={theme.text}>
              We were unable to process your recent payment of <span style={theme.highlight}>{amount}</span> for your TipLytic Pro subscription using the card ending in <span style={theme.highlight}>{lastFour}</span>.
            </Text>
            <Text style={theme.text}>
              To keep your premium features, including the Accumulator Builder and VIP Leaderboards, please update your payment method.
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard/billing">
                Update Payment Method
              </Button>
            </Section>
            <Hr style={theme.hr} />
            <Text style={theme.footerText}>
              If you have any questions, reply to this email to contact our support team.
              <br />
              © {new Date().getFullYear()} TipLytic. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
