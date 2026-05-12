"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { createClientComponentClient } from "@/lib/supabase-client";

type Fixture = {
  id: string | number;
  league?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_date?: string | null;
};

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
}

function makeTitle(f: Fixture) {
  return `${f.home_team ?? "Home"} vs ${f.away_team ?? "Away"}`;
}

export default function Page() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [matchId, setMatchId] = useState("");
  const [correctTip, setCorrectTip] = useState<"Home Win" | "Draw" | "Away Win">("Home Win");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      const now = new Date();
      const start = startOfUtcDay(now).toISOString();
      const end = endOfUtcDay(now).toISOString();

      const { data, error: err } = await supabase
        .from("predictions")
        .select("id,league,home_team,away_team,match_date")
        .gte("match_date", start)
        .lte("match_date", end)
        .order("match_date", { ascending: true })
        .limit(300);

      if (cancelled) return;
      if (err) {
        setFixtures([]);
        setError(err.message);
        setLoading(false);
        return;
      }

      const rows = (data as Fixture[] | null) ?? [];
      setFixtures(rows);
      if (!matchId && rows[0]?.id != null) setMatchId(String(rows[0].id));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [matchId, supabase]);

  async function setChallenge() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/daily-challenge/admin/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        return;
      }
      setMessage("Challenge set for today.");
    } finally {
      setSaving(false);
    }
  }

  async function resolveChallenge() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/daily-challenge/admin/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ correctTip }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; points?: number; correctCount?: number };
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        return;
      }
      setMessage(`Resolved. Winners: ${json.correctCount ?? 0}. Points: ${json.points ?? 0}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">Daily Challenge Admin</div>
          <p className="mt-1 text-sm text-muted">
            Set today’s challenge match and resolve it after the result is known.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-2xl border border-border bg-background/20 p-6 text-sm text-muted">
              Loading fixtures…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs font-medium text-foreground">Set challenge match</div>
                <select
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
                >
                  {fixtures.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>
                      {makeTitle(f)}
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <Button type="button" variant="primary" onClick={setChallenge} disabled={saving || !matchId}>
                    {saving ? "Saving…" : "Set today’s challenge"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/20 p-4">
                <div className="text-xs font-medium text-foreground">Resolve challenge</div>
                <select
                  value={correctTip}
                  onChange={(e) => setCorrectTip(e.target.value as typeof correctTip)}
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-background/30 px-3 text-sm text-foreground"
                >
                  <option value="Home Win">Home Win</option>
                  <option value="Draw">Draw</option>
                  <option value="Away Win">Away Win</option>
                </select>
                <div className="mt-3">
                  <Button type="button" variant="secondary" onClick={resolveChallenge} disabled={saving}>
                    {saving ? "Saving…" : "Resolve"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Container>
  );
}
