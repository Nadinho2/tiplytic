"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { Toaster } from "sonner";

import { cn } from "@/utils/cn";

type NavItem = { label: string; href: string };
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [{ label: "Dashboard", href: "/admin" }],
  },
  {
    title: "PREDICTIONS",
    items: [
      { label: "All Predictions", href: "/admin/predictions" },
      { label: "Add Prediction", href: "/admin/predictions/new" },
      { label: "Admin Pick", href: "/admin/admin-pick" },
      { label: "N8N Logs", href: "/admin/n8n-logs" },
    ],
  },
  {
    title: "USERS",
    items: [
      { label: "All Users", href: "/admin/users" },
      { label: "Subscriptions", href: "/admin/subscriptions" },
      { label: "Revenue", href: "/admin/subscriptions?tab=revenue" },
    ],
  },
  {
    title: "COMMUNITY",
    items: [
      { label: "Tipsters", href: "/admin/community?tab=tipsters" },
      { label: "Daily Challenge", href: "/admin/community?tab=challenge" },
      { label: "Leaderboard", href: "/admin/community?tab=leaderboard" },
    ],
  },
  {
    title: "COMMS",
    items: [
      { label: "Email Broadcasts", href: "/admin/emails" },
      { label: "Notification History", href: "/admin/emails?tab=history" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { label: "Affiliates", href: "/admin/affiliates?tab=affiliates" },
      { label: "Referrals", href: "/admin/affiliates?tab=referrals" },
      { label: "Payouts", href: "/admin/affiliates?tab=payouts" },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { label: "Site Settings", href: "/admin/settings" },
      { label: "Feature Flags", href: "/admin/settings?tab=flags" },
    ],
  },
];

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const flatLinks = useMemo(() => NAV.flatMap((s) => s.items), []);
  const activeHref = useMemo(() => {
    const exact = flatLinks.find((l) => l.href === pathname)?.href;
    if (exact) return exact;
    const prefix = flatLinks
      .map((l) => l.href)
      .filter((h) => h !== "/admin")
      .sort((a, b) => b.length - a.length)
      .find((h) => pathname.startsWith(h));
    return prefix ?? "/admin";
  }, [flatLinks, pathname]);

  function Sidebar({ className }: { className?: string }) {
    return (
      <aside
        className={cn(
          "flex h-full w-[280px] flex-col border-r border-white/10 bg-[#0D1320]",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold tracking-tight text-white">TipLytic</div>
            <span className="rounded-md bg-[#3B82F6] px-2 py-0.5 text-xs font-semibold text-white">
              ADMIN
            </span>
          </div>
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-5 text-white/70" />
          </button>
        </div>

        <nav className="flex-1 overflow-auto px-3 pb-4">
          {NAV.map((section) => (
            <div key={section.title} className="mb-5">
              <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-white/40">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center rounded-xl px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white",
                        active && "bg-[#3B82F6]/15 text-white ring-1 ring-[#3B82F6]/30",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/50">
          Protected by Clerk
        </div>
      </aside>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <Toaster theme="dark" richColors closeButton />
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0">
              <Sidebar className="shadow-2xl" />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#080C14]/80 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 lg:hidden"
                  onClick={() => setOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="size-5" />
                </button>
                <div>
                  <div className="text-sm font-semibold text-white">Admin Panel</div>
                  <div className="text-xs text-white/50">{formatDateTime(now)}</div>
                </div>
              </div>

              <Link
                href="/"
                target="_blank"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                View Site
              </Link>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

