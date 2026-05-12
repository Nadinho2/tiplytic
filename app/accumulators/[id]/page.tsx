import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { ShareActions } from "@/components/accumulator/ShareActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createServiceClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Selection = { prediction_id: string; tip: string; odds: number };

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("accumulators")
    .select("id,selections,combined_odds,stake,potential_return,result,created_at")
    .eq("id", decodedId)
    .maybeSingle<{
      id: string;
      selections: Selection[];
      combined_odds: number | null;
      stake: number | null;
      potential_return: number | null;
      result: string | null;
      created_at: string | null;
    }>();

  if (!data) notFound();

  const selections = Array.isArray(data.selections) ? data.selections : [];
  const result = String(data.result ?? "pending").toLowerCase();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareUrl = `${appUrl}/accumulators/${encodeURIComponent(data.id)}`;
  const text = `My TipLytic accumulator: ${selections.length} selections @ ${Number(data.combined_odds ?? 0).toFixed(2)} odds`;

  return (
    <Container className="py-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Accumulator</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Share slip
          </h1>
          <p className="mt-3 text-sm text-muted">
            A shareable snapshot of the selections and combined odds.
          </p>
        </div>
        <Badge>{String(data.result ?? "pending").toUpperCase()}</Badge>
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">TipLytic Accumulator</div>
              <div className="mt-1 text-sm text-muted">
                {selections.length} selections • Combined odds{" "}
                <span className="font-semibold text-foreground">
                  {Number(data.combined_odds ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
            <span
              className={
                result === "win"
                  ? "rounded-full border border-[#10B981]/25 bg-[#10B981]/10 px-3 py-1 text-xs font-semibold text-[#10B981]"
                  : result === "loss"
                    ? "rounded-full border border-[#EF4444]/25 bg-[#EF4444]/10 px-3 py-1 text-xs font-semibold text-[#EF4444]"
                    : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-muted"
              }
            >
              {String(data.result ?? "pending").toUpperCase()}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-8">Selection</div>
                  <div className="col-span-4 text-right">Odds</div>
                </div>
                <div className="divide-y divide-border bg-card/40">
                  {selections.length ? (
                    selections.map((s, idx) => (
                      <div key={`${s.prediction_id}-${idx}`} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
                        <div className="col-span-8 font-medium text-foreground">{s.tip}</div>
                        <div className="col-span-4 text-right text-muted">{Number(s.odds).toFixed(2)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-muted">No selections.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Stake</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data.stake != null ? formatMoney(Number(data.stake)) : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Potential return</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data.potential_return != null
                    ? formatMoney(Number(data.potential_return))
                    : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs text-muted">Share</div>
                <div className="mt-3">
                  <ShareActions url={shareUrl} text={text} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
