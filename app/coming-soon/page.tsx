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
          We&apos;re building realtime picks, tipster profiles, and verified results.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/predictions" variant="primary">
            View predictions
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
