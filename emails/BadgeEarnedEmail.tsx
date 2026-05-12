import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface BadgeEarnedEmailProps {
  username: string;
  badgeName: string;
  badgeDescription: string;
}

export default function BadgeEarnedEmail({ username = 'User', badgeName = 'Sharpshooter', badgeDescription = 'Win 5 predictions in a row.' }: BadgeEarnedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Achievement Unlocked: {badgeName} 🏆</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={{...theme.title, textAlign: 'center'}}>New Badge Unlocked! 🏅</Heading>
            <Text style={{...theme.text, textAlign: 'center'}}>
              Incredible work, {username}! You've just earned a new badge on TipLytic.
            </Text>
            
            <Section style={theme.statBox}>
              <Text style={theme.statValue}>{badgeName}</Text>
              <Text style={theme.statLabel}>{badgeDescription}</Text>
            </Section>

            <Text style={theme.text}>
              This badge is now visible on your public tipster profile for the entire community to see. Keep making those sharp picks and stacking up your achievements!
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard/badges">
                View All Badges
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
