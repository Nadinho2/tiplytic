"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

export function ShareActions({
  url,
  text,
}: {
  url: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  const xHref = useMemo(() => {
    const u = new URL("https://twitter.com/intent/tweet");
    u.searchParams.set("text", text);
    u.searchParams.set("url", url);
    return u.toString();
  }, [text, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </Button>
      <a
        href={xHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background/30 px-4 text-sm font-semibold text-foreground transition hover:border-accent/30"
      >
        Share to X
      </a>
    </div>
  );
}
