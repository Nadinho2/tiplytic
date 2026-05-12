"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { AlertTriangle } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type BankrollResponse = {
  startingBalance: number;
  currentBalance: number;
  peakBalance: number;
  sparkline: Array<{ date: string; balance: number }>;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

function useAnimatedNumber(value: number) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const from = display;
    const to = value;
    if (from === to) return;

    const duration = 450;
    const start = performance.now();

    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [display, value]);

  return display;
}

export function BankrollWidget() {
  const [data, setData] = useState<BankrollResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const animatedBalance = useAnimatedNumber(data?.currentBalance ?? 0);

  const profitLoss = useMemo(() => {
    if (!data) return { amount: 0, pct: 0 };
    const amount = data.currentBalance - data.startingBalance;
    const pct =
      data.startingBalance > 0 ? (amount / data.startingBalance) * 100 : 0;
    return { amount, pct };
  }, [data]);

  async function load() {
    setIsLoading(true);
    setError(null);
    const res = await fetch("/api/bankroll", { method: "GET" });
    if (!res.ok) {
      setError(`Request failed (${res.status})`);
      setData(null);
      setIsLoading(false);
      return;
    }
    const json = (await res.json()) as BankrollResponse;
    setData(json);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function reset() {
    const res = await fetch("/api/bankroll/reset", { method: "POST" });
    if (!res.ok) {
      setError(`Reset failed (${res.status})`);
      return;
    }
    setShowConfirm(false);
    await load();
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Virtual Bankroll
            </div>
            <div className="mt-1 text-sm text-muted">Starting balance ₦10,000</div>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/dashboard/bankroll" variant="secondary" size="sm">
              View history
            </ButtonLink>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirm(true)}
            >
              Reset bankroll
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
            <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
            <div className="h-24 animate-pulse rounded-2xl border border-border bg-white/5" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">
            {error}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background/20 p-4 lg:col-span-2">
              <div className="text-xs text-muted">Current balance</div>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {formatMoney(Math.round(animatedBalance))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    profitLoss.amount >= 0
                      ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
                      : "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]",
                  )}
                >
                  {profitLoss.amount >= 0 ? "+" : ""}
                  {formatMoney(profitLoss.amount)} ({formatPercent(profitLoss.pct)})
                </div>
                <div className="text-xs text-muted">
                  Peak:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(data.peakBalance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/20 p-4">
              <div className="text-xs text-muted">Trend (30 days)</div>
              <div className="mt-3 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.sparkline}>
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-xs text-muted">
                Based on your bankroll transactions.
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      {showConfirm ? (
        <div className="absolute inset-0 grid place-items-center bg-background/70 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl border border-border bg-background/20 text-muted">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Reset bankroll?
                </div>
                <div className="mt-1 text-sm text-muted">
                  This resets your balance to ₦10,000 and clears your history.
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
              <Button type="button" variant="primary" className="flex-1" onClick={reset}>
                Confirm reset
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

