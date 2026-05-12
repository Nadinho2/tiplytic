import { ReactElement } from 'react';
import { resend, SENDER_EMAIL } from './resend';

interface SendEmailProps {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
}

export async function sendEmail({ to, subject, react, replyTo }: SendEmailProps) {
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject,
      react,
      replyTo,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error };
  }
}
