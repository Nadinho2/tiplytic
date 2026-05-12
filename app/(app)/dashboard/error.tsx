"use client";

import { useEffect } from "react";

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
    <div className="rounded-2xl border border-border bg-card/70 p-6">
      <h1 className="text-base font-semibold">Dashboard error</h1>
      <p className="mt-2 text-sm text-muted">
        Refresh this section to try again.
      </p>
      <div className="mt-6">
        <button
          onClick={() => reset()}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-medium text-white transition hover:shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_28px_rgba(59,130,246,0.18)]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
