import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function Page() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/70 p-6 text-center">
        <p className="text-sm font-medium text-accent">Coming soon</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New features are on the way
        </h1>
        <p className="mt-3 text-sm text-muted">
          We&apos;re actively shipping improvements across subscriptions, community predictions, and
          leaderboards.
        </p>

        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-background/20 p-4 text-left text-sm text-muted">
          <div className="text-sm font-semibold text-foreground">What&apos;s next</div>
          <ul className="list-disc space-y-2 pl-5">
            <li>More tipster tools: richer prediction types, edits before lock, and profiles.</li>
            <li>Better leaderboards: filters, streak views, and improved ranking logic.</li>
            <li>Subscription controls: clearer status, renewals, and payment history.</li>
            <li>Daily challenges: smarter match selection and weekly challenge rounds.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/predictions" variant="primary">
            View predictions
          </ButtonLink>
          <ButtonLink href="/dashboard/community" variant="secondary">
            Submit a pick
          </ButtonLink>
          <ButtonLink href="/pricing" variant="ghost">
            See pricing
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
