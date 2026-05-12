import Link from "next/link";

import { cn } from "@/utils/cn";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/picks", label: "Picks" },
  { href: "/dashboard/community", label: "Community" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "hidden w-64 shrink-0 border-r border-border bg-background/40 backdrop-blur md:block",
        className,
      )}
    >
      <div className="flex h-16 items-center px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-wide hover:text-accent"
        >
          TipLytic
        </Link>
      </div>
      <nav className="px-2 pb-6">
        <ul className="space-y-1">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
