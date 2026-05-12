## TipLytic

Smart Betting Tips & Community Predictions.

### Stack

- Next.js 15 App Router (React Server Components + streaming)
- Tailwind CSS (pure)
- Clerk authentication (email + Google + Apple)

## Getting Started

1) Install dependencies:

```bash
npm install
```

2) Create an `.env.local` based on `.env.example` and fill:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

3) Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000

### Routes

- `/` Marketing landing page
- `/sign-in` and `/sign-up` Clerk auth
- `/dashboard` Protected app
- `/api/health` Public health check
- `/api/me` Protected user info

### Clerk Setup Notes

- Enable Email + Google + Apple providers in the Clerk dashboard.
- Set redirect URLs to include `http://localhost:3000/*` for local development.
