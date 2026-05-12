import { Container } from "@/components/ui/container";

export default function Page() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/70 p-6">
        <p className="text-sm font-medium text-accent">Disclaimer</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Informational use only
        </h1>
        <p className="mt-4 text-sm text-muted">
          Predictions are for informational purposes only and do not guarantee
          outcomes. Always gamble responsibly.
        </p>
        <p className="mt-3 text-sm text-muted">
          18+ only. If you need help, seek support from local responsible gambling
          services.
        </p>
      </div>
    </Container>
  );
}
