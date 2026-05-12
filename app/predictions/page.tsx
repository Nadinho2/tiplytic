import { Container } from "@/components/ui/container";
import { PredictionsFeed } from "@/components/predictions/PredictionsFeed";

export default function Page() {
  return (
    <Container className="py-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Predictions</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Today&apos;s Predictions
          </h1>
          <p className="mt-3 text-sm text-muted">
            Live feed with league filters and realtime updates.
          </p>
        </div>
      </div>
      <PredictionsFeed />
    </Container>
  );
}
