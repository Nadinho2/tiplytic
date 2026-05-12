// Shared styling for all TipLytic React Email templates
// Ensures a consistent dark theme (#080C14 background, #3B82F6 accent)

export const theme = {
  main: {
    backgroundColor: '#080C14',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    color: '#ffffff',
    padding: '40px 0',
  },
  container: {
    margin: '0 auto',
    padding: '20px',
    maxWidth: '600px',
  },
  header: {
    padding: '20px 0',
    textAlign: 'center' as const,
  },
  logo: {
    color: '#3B82F6', // Blue accent
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0',
    letterSpacing: '-1px',
  },
  content: {
    backgroundColor: '#111827', // Slightly lighter dark background for the card
    padding: '40px',
    borderRadius: '12px',
    border: '1px solid #1F2937',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '16px',
    marginTop: '0',
  },
  text: {
    fontSize: '16px',
    color: '#9CA3AF', // Gray text
    lineHeight: '26px',
    marginBottom: '24px',
  },
  highlight: {
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    marginTop: '32px',
    marginBottom: '32px',
  },
  button: {
    backgroundColor: '#3B82F6',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 'bold',
    display: 'inline-block',
    fontSize: '16px',
  },
  hr: {
    borderColor: '#1F2937',
    margin: '32px 0',
  },
  footerText: {
    fontSize: '14px',
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: '22px',
  },
  statBox: {
    backgroundColor: '#080C14',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #1F2937',
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  statLabel: {
    fontSize: '14px',
    color: '#9CA3AF',
    marginBottom: '4px',
    display: 'block',
  },
  statValue: {
    fontSize: '24px',
    color: '#3B82F6',
    fontWeight: 'bold',
    display: 'block',
  },
  badgeImage: {
    margin: '0 auto 20px',
    display: 'block',
  }
};
