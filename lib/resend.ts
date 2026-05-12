import { Resend } from 'resend';

// Initialize the Resend client with the API key from environment variables
// Make sure to add RESEND_API_KEY to your .env.local file
export const resend = new Resend(process.env.RESEND_API_KEY);

// Define the default sender address
// Note: You will need to verify your domain in Resend for this to work in production
export const SENDER_EMAIL = 'TipLytic <noreply@tiplytic.com>';
