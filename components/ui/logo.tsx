import Link from "next/link";

import { cn } from "@/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-white/5",
        className,
      )}
    >
      <span className="relative grid size-8 place-items-center rounded-xl bg-accent text-zinc-950 shadow-[0_0_22px_rgba(0,255,136,0.18)]">
        TL
      </span>
      <span className="text-sm font-semibold tracking-wide">TipLytic</span>
    </Link>
  );
}
