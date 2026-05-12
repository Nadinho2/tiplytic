"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, Trophy, LayoutDashboard, User, Users } from "lucide-react";

import { useAuth } from "@clerk/nextjs";

import { cn } from "@/utils/cn";

type Tab = {
  href: string;
  label: string;
  Icon: typeof Home;
  requiresAuth?: boolean;
};

const tabs: Tab[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/predictions", label: "Predictions", Icon: ListChecks },
  { href: "/tipsters", label: "Tipsters", Icon: Trophy },
  { href: "/dashboard/community", label: "Community", Icon: Users, requiresAuth: true },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, requiresAuth: true },
  { href: "/profile", label: "Profile", Icon: User, requiresAuth: true },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { userId } = useAuth();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-6 px-2 py-2">
        {tabs.map((t) => {
          const href = t.requiresAuth && !userId ? "/sign-in" : t.href;
          const isActive = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);

          return (
            <Link
              key={t.label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] text-muted transition",
                isActive &&
                  "text-foreground shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_0_26px_rgba(59,130,246,0.16)]",
              )}
            >
              <t.Icon
                className={cn(
                  "size-5",
                  isActive ? "text-accent" : "text-muted",
                )}
              />
              <span className={cn(isActive && "text-foreground")}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
