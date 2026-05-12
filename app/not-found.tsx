import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/70 p-6 text-center">
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-muted">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/" variant="primary">
            Go home
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
