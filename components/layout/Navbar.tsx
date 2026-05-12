"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { UserButton } from "@clerk/nextjs";

import { useUser } from "@/hooks/useUser";
import { cn } from "@/utils/cn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const nav = [
  { href: "/", label: "Home" },
  { href: "/predictions", label: "Predictions" },
  { href: "/tipsters", label: "Tipsters" },
  { href: "/pricing", label: "Pricing" },
];

function getTierLabel(tier?: string | null) {
  if (!tier) return "Free";
  return tier[0]?.toUpperCase() + tier.slice(1);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, userSubscription, isLoading } = useUser();

  const tierLabel = isLoading ? "…" : getTierLabel(userSubscription?.tier);
  const navItems = user
    ? [...nav, { href: "/dashboard", label: "Dashboard" }, { href: "/dashboard/community", label: "Community" }]
    : nav;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-sm font-semibold tracking-wide text-foreground"
        >
          TipLytic 🏆
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-2 text-sm text-muted transition hover:text-foreground",
                  isActive && "text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-0 -bottom-[17px] h-0.5 bg-accent transition-opacity",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-xl border border-border bg-card/70 text-muted transition hover:border-accent/35 hover:text-foreground hover:shadow-[0_0_0_1px_rgba(59,130,246,0.22),0_0_20px_rgba(59,130,246,0.10)]"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
              </button>

              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted hover:border-accent/35 hover:text-foreground"
                >
                  {tierLabel}
                </Link>
              </div>

              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            </>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost" size="sm">
                Sign In
              </ButtonLink>
              <ButtonLink href="/sign-up" variant="primary" size="sm">
                Sign Up
              </ButtonLink>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
