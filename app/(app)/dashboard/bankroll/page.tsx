import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TxRow = {
  id: string;
  created_at: string;
  match: string | null;
  tip: string | null;
  odds: number | null;
  stake: number | null;
  returns: number | null;
  profit_loss: number | null;
  balance_after: number | null;
  result: string | null;
  type: string | null;
};

export default async function Page() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createServiceClient();

  const { data: txs, error } = await supabase
    .from("bankroll_transactions")
    .select(
      "id,created_at,match,tip,odds,stake,returns,profit_loss,balance_after,result,type",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2000);

  const rows = (txs as TxRow[] | null) ?? [];

  const totalStaked = rows.reduce((sum, r) => sum + (r.stake ?? 0), 0);
  const totalReturned = rows.reduce((sum, r) => sum + (r.returns ?? 0), 0);
  const net = rows.reduce((sum, r) => sum + (r.profit_loss ?? 0), 0);
  const roi = totalStaked > 0 ? (net / totalStaked) * 100 : 0;

  return (
    <Container className="py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">Virtual Bankroll</p>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted">
          Full transaction history with running balance after each bet.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="text-xs text-muted">Total Staked</div>
          <div className="mt-2 text-xl font-semibold text-foreground">
            {formatMoney(totalStaked)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="text-xs text-muted">Total Returned</div>
          <div className="mt-2 text-xl font-semibold text-foreground">
            {formatMoney(totalReturned)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="text-xs text-muted">Net P&amp;L</div>
          <div className={net >= 0 ? "mt-2 text-xl font-semibold text-[#10B981]" : "mt-2 text-xl font-semibold text-[#EF4444]"}>
            {net >= 0 ? "+" : ""}
            {formatMoney(net)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="text-xs text-muted">ROI%</div>
          <div className="mt-2 text-xl font-semibold text-foreground">
            {roi.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Transactions</h2>
            <p className="mt-1 text-sm text-muted">
              Date, match, stake, returns, profit, and balance after settlement.
            </p>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
                {error.message}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                  <div className="col-span-3">Date</div>
                  <div className="col-span-3">Match</div>
                  <div className="col-span-2">Tip</div>
                  <div className="col-span-1 text-right">Stake</div>
                  <div className="col-span-1 text-right">Return</div>
                  <div className="col-span-1 text-right">P&amp;L</div>
                  <div className="col-span-1 text-right">Balance</div>
                </div>
                <div className="divide-y divide-border bg-card/40">
                  {rows.length ? (
                    rows.map((r) => (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 items-center gap-y-2 px-4 py-3 text-sm"
                      >
                        <div className="col-span-12 text-muted sm:col-span-3">
                          {formatDate(r.created_at)}
                          <div className="mt-1 text-xs text-muted">
                            {r.type ?? "—"}{r.result ? ` • ${r.result}` : ""}
                          </div>
                        </div>
                        <div className="col-span-12 font-medium text-foreground sm:col-span-3">
                          {r.match ?? "—"}
                          <div className="mt-1 text-xs text-muted">
                            Odds {r.odds ?? "—"}
                          </div>
                        </div>
                        <div className="col-span-12 text-muted sm:col-span-2">
                          {r.tip ?? "—"}
                        </div>
                        <div className="col-span-3 text-right text-foreground sm:col-span-1">
                          {formatMoney(r.stake ?? 0)}
                        </div>
                        <div className="col-span-3 text-right text-foreground sm:col-span-1">
                          {formatMoney(r.returns ?? 0)}
                        </div>
                        <div
                          className={
                            (r.profit_loss ?? 0) >= 0
                              ? "col-span-3 text-right font-semibold text-[#10B981] sm:col-span-1"
                              : "col-span-3 text-right font-semibold text-[#EF4444] sm:col-span-1"
                          }
                        >
                          {formatMoney(r.profit_loss ?? 0)}
                        </div>
                        <div className="col-span-3 text-right font-semibold text-foreground sm:col-span-1">
                          {formatMoney(r.balance_after ?? 0)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-muted">
                      No transactions yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

