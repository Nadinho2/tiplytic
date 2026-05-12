import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface AccountMilestoneEmailProps {
  username: string;
  milestone: string;
  statValue: string;
}

export default function AccountMilestoneEmail({ username = 'User', milestone = '100th Prediction Submitted', statValue = '100 Picks' }: AccountMilestoneEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Congratulations on your new TipLytic milestone!</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={{...theme.title, textAlign: 'center'}}>Milestone Reached! 🚀</Heading>
            <Text style={{...theme.text, textAlign: 'center'}}>
              Massive respect, {username}. You've just hit a major milestone on the platform.
            </Text>
            
            <Section style={theme.statBox}>
              <Text style={theme.statLabel}>Achievement</Text>
              <Text style={theme.statValue}>{milestone}</Text>
              <Text style={{...theme.statLabel, marginTop: '8px'}}>{statValue}</Text>
            </Section>

            <Text style={theme.text}>
              Dedication like yours is what makes the TipLytic community great. Your profile has been updated to reflect this achievement.
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard/profile">
                View Your Profile
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
