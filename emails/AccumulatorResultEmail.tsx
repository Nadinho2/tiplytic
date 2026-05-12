import { Html, Head, Body, Container, Section, Text, Heading, Button, Hr, Preview } from '@react-email/components';
import * as React from 'react';
import { theme } from './theme';

interface AccumulatorResultEmailProps {
  username: string;
  status: 'won' | 'lost' | 'void';
  odds: number;
  payout: number;
  legs: number;
}

export default function AccumulatorResultEmail({ 
  username = 'User', 
  status = 'won', 
  odds = 5.50, 
  payout = 55.00,
  legs = 4
}: AccumulatorResultEmailProps) {
  const isWin = status === 'won';
  const isVoid = status === 'void';
  
  return (
    <Html>
      <Head />
      <Preview>{`Your ${legs}-leg Accumulator has been settled`}</Preview>
      <Body style={theme.main}>
        <Container style={theme.container}>
          <Section style={theme.header}>
            <Heading style={theme.logo}>TipLytic</Heading>
          </Section>
          <Section style={theme.content}>
            <Heading style={{...theme.title, textAlign: 'center'}}>
              Accumulator {isWin ? 'Won! 🎉' : isVoid ? 'Voided ⚪' : 'Lost ❌'}
            </Heading>
            <Text style={{...theme.text, textAlign: 'center'}}>
              Hi {username}, your {legs}-leg accumulator has been settled.
            </Text>
            
            <Section style={{...theme.statBox, borderColor: isWin ? '#10B981' : isVoid ? '#3B82F6' : '#EF4444'}}>
              <Text style={theme.statLabel}>Final Odds: @{odds.toFixed(2)}</Text>
              <Text style={{...theme.statValue, color: isWin ? '#10B981' : isVoid ? '#3B82F6' : '#EF4444'}}>
                {isWin ? `+₮${payout.toFixed(2)}` : isVoid ? `₮${payout.toFixed(2)} Refunded` : 'Slip Busted'}
              </Text>
            </Section>

            <Text style={theme.text}>
              {isWin
                ? 'What a read! Your winnings have been added to your virtual bankroll. Time to climb that leaderboard.'
                : isVoid
                  ? 'One or more legs were voided, so your stake has been returned to your virtual bankroll.'
                  : 'Tough break. One bad beat is all it takes. Shake it off and build a new slip!'}
            </Text>
            <Section style={theme.buttonContainer}>
              <Button style={theme.button} href="https://tiplytic.com/dashboard/accumulator">
                Build New Accumulator
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
