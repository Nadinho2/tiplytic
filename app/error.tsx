"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/70 p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          Try again. If the issue persists, please contact support.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-medium text-white transition hover:shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_28px_rgba(59,130,246,0.18)]"
          >
            Retry
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_0_22px_rgba(59,130,246,0.10)]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
