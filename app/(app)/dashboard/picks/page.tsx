import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-base font-semibold">Picks</h1>
        <p className="mt-1 text-sm text-muted">
          This section is ready for Supabase-backed picks.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted">
          Next: add a picks table, filters, and a form using Server Actions.
        </div>
      </CardContent>
    </Card>
  );
}
