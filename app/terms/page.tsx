import { Container } from "@/components/ui/container";

export default function Page() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/70 p-6">
        <p className="text-sm font-medium text-accent">Terms</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Terms of service
        </h1>
        <p className="mt-4 text-sm text-muted">
          This page is a placeholder. Add your platform terms here.
        </p>
      </div>
    </Container>
  );
}
