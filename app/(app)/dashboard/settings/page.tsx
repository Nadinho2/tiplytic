import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-base font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Account and preferences live here.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted">
          Next: connect billing and personalization settings.
        </div>
      </CardContent>
    </Card>
  );
}
