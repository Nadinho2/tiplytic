import Link from "next/link";

import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="text-sm font-semibold tracking-wide text-foreground">
            TipLytic 🏆
          </div>
          <p className="mt-3 text-sm text-muted">
            Accurate match analysis and transparent tracking for serious bettors.
          </p>
          <p className="mt-4 text-xs text-muted">
            18+ | For informational purposes only
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-muted md:grid-cols-3">
          <Link href="/predictions" className="hover:text-foreground">
            Predictions
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/tipsters" className="hover:text-foreground">
            Tipsters
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/disclaimer" className="hover:text-foreground">
            Disclaimer
          </Link>
          <Link href="/coming-soon" className="hover:text-foreground">
            Coming soon
          </Link>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted">
          <a
            href="https://x.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            X
          </a>
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            WhatsApp community
          </a>
        </div>
      </Container>
    </footer>
  );
}
