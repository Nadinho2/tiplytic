import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface ChallengeWonEmailProps {
  username: string;
  challengeName: string;
  pointsEarned: number;
}

export default function ChallengeWonEmail({ username = 'User', challengeName = 'Weekend Premier League Challenge', pointsEarned = 30 }: ChallengeWonEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You won the Daily Challenge: {challengeName}!</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={{...theme.title, textAlign: 'center'}}>Challenge Completed! 🎯</Heading>
            <Text style={{...theme.text, textAlign: 'center'}}>
              Spot on, {username}! Your prediction for the <span style={theme.highlight}>{challengeName}</span> was perfectly accurate.
            </Text>
            
            <Section style={theme.statBox}>
              <Text style={theme.statLabel}>Points Earned</Text>
              <Text style={{...theme.statValue, color: '#10B981'}}>+{pointsEarned} PTS</Text>
            </Section>

            <Text style={theme.text}>
              Your points have been added to the Weekly Leaderboard. You're one step closer to becoming the Weekly Champion. Keep the streak going!
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard/challenges">
                View Leaderboard
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
