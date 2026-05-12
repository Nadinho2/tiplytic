import "server-only";

import { currentUser } from "@clerk/nextjs/server";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export async function DashboardSummary() {
  const user = await currentUser();
  const name =
    user?.firstName ||
    user?.username ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "there";

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">Welcome back, {name}</h2>
        <p className="mt-1 text-sm text-muted">
          Here is your overall betting performance summary.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="text-xs text-muted">Total Picks</div>
            <div className="mt-2 text-2xl font-semibold">124</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="text-xs text-muted">Win rate</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-500">58.1%</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="text-xs text-muted">Net Profit (₦)</div>
            <div className="mt-2 text-2xl font-semibold text-accent">+₦42,500</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="text-xs text-muted">Active Streak</div>
            <div className="mt-2 text-2xl font-semibold text-amber-500">3 W</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
