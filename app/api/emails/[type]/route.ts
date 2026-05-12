import React from "react";
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';

// Import all templates
import WelcomeEmail from '@/emails/WelcomeEmail';
import PaymentFailedEmail from '@/emails/PaymentFailedEmail';
import SubscriptionExpiredEmail from '@/emails/SubscriptionExpiredEmail';
import BadgeEarnedEmail from '@/emails/BadgeEarnedEmail';
import ChallengeWonEmail from '@/emails/ChallengeWonEmail';
import BankrollWarningEmail from '@/emails/BankrollWarningEmail';
import AccumulatorResultEmail from '@/emails/AccumulatorResultEmail';
import PickLockedEmail from '@/emails/PickLockedEmail';
import AccountMilestoneEmail from '@/emails/AccountMilestoneEmail';
import WeeklySummaryEmail from '@/emails/WeeklySummaryEmail';
import WeeklyReportEmail from '@/emails/WeeklyReportEmail';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const body = await req.json();
    
    // We expect 'email' to always be present, and 'data' to contain template-specific props
    const { email, previewOnly, ...data } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    let reactElement: React.ReactElement;
    let subject = '';

    // Route to the correct template based on the [type] param
    switch (type) {
      case 'welcome':
        reactElement = React.createElement(WelcomeEmail, { username: data.username });
        subject = 'Welcome to TipLytic!';
        break;
      
      case 'payment-failed':
        reactElement = React.createElement(PaymentFailedEmail, {
          username: data.username,
          amount: data.amount,
          lastFour: data.lastFour,
        });
        subject = 'Action Required: Payment Failed';
        break;
        
      case 'subscription-expired':
        reactElement = React.createElement(SubscriptionExpiredEmail, { username: data.username });
        subject = 'Your TipLytic Pro subscription has expired';
        break;
        
      case 'badge-earned':
        reactElement = React.createElement(BadgeEarnedEmail, {
          username: data.username,
          badgeName: data.badgeName,
          badgeDescription: data.badgeDescription,
        });
        subject = `Achievement Unlocked: ${data.badgeName || 'New Badge'} 🏆`;
        break;
        
      case 'challenge-won':
        reactElement = React.createElement(ChallengeWonEmail, {
          username: data.username,
          challengeName: data.challengeName,
          pointsEarned: data.pointsEarned,
        });
        subject = `You won the Challenge: ${data.challengeName || 'Daily Challenge'}!`;
        break;
        
      case 'bankroll-warning':
        reactElement = React.createElement(BankrollWarningEmail, {
          username: data.username,
          currentBalance: data.currentBalance,
        });
        subject = 'Warning: Your virtual bankroll is running low';
        break;
        
      case 'accumulator-result':
        reactElement = React.createElement(AccumulatorResultEmail, {
          username: data.username,
          status: data.status,
          odds: data.odds,
          payout: data.payout,
          legs: data.legs,
        });
        subject = `Accumulator ${data.status === 'won' ? 'Won! 🎉' : 'Settled'}`;
        break;
        
      case 'pick-locked':
        reactElement = React.createElement(PickLockedEmail, {
          username: data.username,
          matchName: data.matchName,
          prediction: data.prediction,
        });
        subject = 'Your pick is officially locked in 🔒';
        break;
        
      case 'account-milestone':
        reactElement = React.createElement(AccountMilestoneEmail, {
          username: data.username,
          milestone: data.milestone,
          statValue: data.statValue,
        });
        subject = 'Congratulations on your new milestone! 🚀';
        break;
        
      case 'weekly-summary':
        reactElement = React.createElement(WeeklySummaryEmail, {
          username: data.username,
          winRate: data.winRate,
          roi: data.roi,
          rankChange: data.rankChange,
        });
        subject = 'Your TipLytic Weekly Summary 📊';
        break;

      case 'weekly-report':
        reactElement = React.createElement(WeeklyReportEmail, {
          username: data.username ?? "Tipster",
          startLabel: data.startLabel ?? "Mon",
          endLabel: data.endLabel ?? "Sun",
          predictionsMade: data.predictionsMade ?? 0,
          wins: data.wins ?? 0,
          losses: data.losses ?? 0,
          winRate: data.winRate ?? 0,
          bankrollChange: data.bankrollChange ?? 0,
          winRateDelta: data.winRateDelta ?? 0,
          streakLabel: data.streakLabel ?? "—",
          bestPick: data.bestPick ?? null,
          leagueBreakdown: data.leagueBreakdown ?? { best: "—", worst: "—" },
          rankDelta: data.rankDelta ?? 0,
          fullStatsUrl: data.fullStatsUrl ?? "https://tiplytic.com/dashboard",
          todaysPredictionsUrl: data.todaysPredictionsUrl ?? "https://tiplytic.com/predictions",
        });
        subject = `Your Week in Review — ${data.startLabel ?? "Mon"} to ${data.endLabel ?? "Sun"}`;
        break;

      default:
        return NextResponse.json({ error: `Invalid email type: ${type}` }, { status: 400 });
    }

    if (previewOnly) {
      const { render } = await import("@react-email/render");
      const previewHtml = await render(reactElement);
      return NextResponse.json({ success: true, previewHtml });
    }

    const result = await sendEmail({ to: email, subject, react: reactElement });
    if (!result.success) throw result.error;

    return NextResponse.json({ success: true, message: `Email (${type}) sent successfully.` });
    
  } catch (error) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
