import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface WeeklySummaryEmailProps {
  username: string;
  winRate: number;
  roi: number;
  rankChange: string;
}

export default function WeeklySummaryEmail({ username = 'User', winRate = 65.5, roi = 12.4, rankChange = '+15' }: WeeklySummaryEmailProps) {
  const isPositiveROI = roi > 0;
  
  return (
    <Html>
      <Head />
      <Preview>Your TipLytic Weekly Performance Summary</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={theme.title}>Weekly Summary 📊</Heading>
            <Text style={theme.text}>
              Here is your performance recap for the past week, {username}.
            </Text>
            
            <Section style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
              <Section style={{...theme.statBox, flex: '1', margin: '0 5px'}}>
                <Text style={theme.statLabel}>Win Rate</Text>
                <Text style={theme.statValue}>{winRate.toFixed(1)}%</Text>
              </Section>
              <Section style={{...theme.statBox, flex: '1', margin: '0 5px'}}>
                <Text style={theme.statLabel}>ROI</Text>
                <Text style={{...theme.statValue, color: isPositiveROI ? '#10B981' : '#EF4444'}}>
                  {isPositiveROI ? '+' : ''}{roi.toFixed(1)}%
                </Text>
              </Section>
              <Section style={{...theme.statBox, flex: '1', margin: '0 5px'}}>
                <Text style={theme.statLabel}>Rank Change</Text>
                <Text style={theme.statValue}>{rankChange}</Text>
              </Section>
            </Section>

            <Text style={theme.text}>
              The leaderboard has been updated. Review your stats and start analyzing the upcoming fixtures to stay ahead of the pack.
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/tipsters">
                View Global Leaderboard
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
