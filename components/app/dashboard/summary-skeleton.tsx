import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSummarySkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-56 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-white/10" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
        </div>
      </CardContent>
    </Card>
  );
}
