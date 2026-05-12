import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  const sp = (await searchParams) ?? {};
  const tab = sp.tab ? String(sp.tab) : "subscriptions";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Users</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Subscriptions & revenue</h1>
        <p className="mt-2 text-sm text-muted">Tab: {tab}</p>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">Coming next</div>
          <div className="mt-1 text-sm text-muted">
            Subscriptions table, upcoming renewals, failed payments, and revenue charts.
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
            This page is now routed correctly (no more 404). UI + data wiring is next.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

