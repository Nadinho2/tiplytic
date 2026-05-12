import { UserControls } from "@/components/auth/user-controls";
import { Container } from "@/components/ui/container";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-card/70 px-3 py-2 text-xs text-muted">
            TipLytic Dashboard
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UserControls />
        </div>
      </Container>
    </header>
  );
}
