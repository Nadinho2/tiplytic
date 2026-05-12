"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Prediction = Record<string, unknown> & { id?: string | number };

const LEAGUES = [
  "EPL",
  "La Liga",
  "Champions League",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Eredivisie",
  "Other",
] as const;

const TYPES = ["1X2", "Over/Under", "BTTS", "Handicap", "Correct Score"] as const;
const RISK = ["Low", "Medium", "High"] as const;
const TIERS = ["free", "basic", "pro", "elite"] as const;

function toDateTimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDateTimeLocalValue(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function PredictionFormClient({ editId }: { editId: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState<Prediction | null>(null);

  const [matchTitle, setMatchTitle] = useState("");
  const [league, setLeague] = useState<(typeof LEAGUES)[number]>("EPL");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [predictionType, setPredictionType] = useState<(typeof TYPES)[number]>("1X2");
  const [tip, setTip] = useState("");
  const [odds, setOdds] = useState("1.50");
  const [confidence, setConfidence] = useState(70);
  const [riskLevel, setRiskLevel] = useState<(typeof RISK)[number]>("Medium");
  const [matchDate, setMatchDate] = useState("");
  const [tierRequired, setTierRequired] = useState<(typeof TIERS)[number]>("free");
  const [isAdminPick, setIsAdminPick] = useState(false);
  const [adminAnalysis, setAdminAnalysis] = useState("");
  const [adminStars, setAdminStars] = useState(4);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!editId) return;
      setLoading(true);
      const res = await fetch(`/api/admin/predictions/${encodeURIComponent(editId)}`, { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { prediction?: Prediction; error?: string } | null;
      if (cancelled) return;
      if (!res || !res.ok || !json?.prediction) {
        toast.error(json?.error || "Failed to load prediction");
        setLoading(false);
        return;
      }
      const p = json.prediction;
      setLoaded(p);
      setMatchTitle(String(p.match_title ?? ""));
      const leagueValue = String(p.league ?? "");
      setLeague(LEAGUES.includes(leagueValue as (typeof LEAGUES)[number]) ? (leagueValue as (typeof LEAGUES)[number]) : "Other");
      setHomeTeam(String(p.home_team ?? ""));
      setAwayTeam(String(p.away_team ?? ""));
      const typeValue = String(p.prediction_type ?? "");
      setPredictionType(TYPES.includes(typeValue as (typeof TYPES)[number]) ? (typeValue as (typeof TYPES)[number]) : "1X2");
      setTip(String(p.tip ?? ""));
      setOdds(String(p.odds ?? "1.50"));
      setConfidence(typeof p.confidence === "number" ? Math.max(0, Math.min(100, Math.floor(p.confidence))) : 70);
      const riskValue = String(p.risk_level ?? "");
      setRiskLevel(RISK.includes(riskValue as (typeof RISK)[number]) ? (riskValue as (typeof RISK)[number]) : "Medium");
      setMatchDate(toDateTimeLocalValue((p.match_date as string | null) ?? null));
      const tierValue = String(p.tier_required ?? "");
      setTierRequired(TIERS.includes(tierValue as (typeof TIERS)[number]) ? (tierValue as (typeof TIERS)[number]) : "free");
      setIsAdminPick(Boolean(p.is_admin_pick));
      setAdminAnalysis(String(p.admin_analysis ?? ""));
      setAdminStars(typeof p.admin_stars === "number" ? Math.max(1, Math.min(5, Math.floor(p.admin_stars))) : 4);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const computedTitle = useMemo(() => {
    if (matchTitle.trim()) return matchTitle.trim();
    if (homeTeam.trim() || awayTeam.trim()) return `${homeTeam.trim() || "Home"} vs ${awayTeam.trim() || "Away"}`;
    return "";
  }, [awayTeam, homeTeam, matchTitle]);

  async function submit() {
    const o = Number(odds);
    const iso = fromDateTimeLocalValue(matchDate);

    if (!tip.trim()) {
      toast.error("Tip is required");
      return;
    }
    if (!Number.isFinite(o) || o < 1.01) {
      toast.error("Odds must be 1.01+");
      return;
    }
    if (!iso) {
      toast.error("Match date/time is required");
      return;
    }
    if (isAdminPick && adminAnalysis.trim().length < 50) {
      toast.error("Admin analysis must be at least 50 characters");
      return;
    }

    setSaving(true);
    const payload = {
      match_title: computedTitle,
      league: league === "Other" ? "Others" : league,
      home_team: homeTeam.trim() || null,
      away_team: awayTeam.trim() || null,
      prediction_type: predictionType,
      tip: tip.trim(),
      odds: o,
      confidence,
      risk_level: riskLevel,
      match_date: iso,
      tier_required: tierRequired,
      is_admin_pick: isAdminPick,
      admin_analysis: isAdminPick ? adminAnalysis.trim() : null,
      admin_stars: isAdminPick ? adminStars : null,
    };

    const res = await fetch(
      editId ? `/api/admin/predictions/${encodeURIComponent(editId)}` : "/api/admin/predictions",
      {
        method: editId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { prediction?: Prediction; error?: string } | null;
    setSaving(false);

    if (!res || !res.ok) {
      toast.error(json?.error || "Save failed");
      return;
    }

    const id = String((json?.prediction?.id ?? loaded?.id ?? editId ?? "") as string);
    toast.success(editId ? "Prediction updated" : "Prediction created");
    router.replace(`/admin/predictions?${id ? `update=${encodeURIComponent(id)}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Predictions</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {editId ? "Edit prediction" : "Add prediction"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Manual creation of a prediction in the main feed.
          </p>
        </div>
        <Link
          href="/admin/predictions"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Back to list
        </Link>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">Prediction details</div>
          <div className="mt-1 text-xs text-muted">Source: manual</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs text-muted">Match Title</div>
                <input
                  value={matchTitle}
                  onChange={(e) => setMatchTitle(e.target.value)}
                  placeholder="Arsenal vs Chelsea"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">League</div>
                <select
                  value={league}
                  onChange={(e) => setLeague(e.target.value as (typeof LEAGUES)[number])}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {LEAGUES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Home Team</div>
                <input
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Home team"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Away Team</div>
                <input
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Away team"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Prediction Type</div>
                <select
                  value={predictionType}
                  onChange={(e) => setPredictionType(e.target.value as (typeof TYPES)[number])}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Tip</div>
                <input
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  placeholder="Over 2.5 / Home Win / BTTS"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Odds</div>
                <input
                  value={odds}
                  onChange={(e) => setOdds(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-muted">Confidence</div>
                  <div className="text-xs font-semibold text-white/80">{confidence}%</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Risk Level</div>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as (typeof RISK)[number])}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {RISK.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Match Date & Time</div>
                <input
                  type="datetime-local"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted">Tier Required</div>
                <select
                  value={tierRequired}
                  onChange={(e) => setTierRequired(e.target.value as (typeof TIERS)[number])}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Is Admin Pick</div>
                    <div className="mt-1 text-xs text-muted">Shows analysis + star rating on the site.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdminPick((v) => !v)}
                    className={`h-8 w-14 rounded-full border border-white/10 p-1 transition ${isAdminPick ? "bg-[#3B82F6]/30" : "bg-white/5"}`}
                  >
                    <span className={`block h-6 w-6 rounded-full bg-white transition ${isAdminPick ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>

                {isAdminPick ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="space-y-2 lg:col-span-2">
                      <div className="text-xs text-muted">Admin Analysis</div>
                      <textarea
                        value={adminAnalysis}
                        onChange={(e) => setAdminAnalysis(e.target.value)}
                        rows={6}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                      />
                      <div className="text-xs text-white/50">{adminAnalysis.trim().length} / 50 min</div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted">Admin Stars (1-5)</div>
                      <select
                        value={adminStars}
                        onChange={(e) => setAdminStars(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : editId ? "Save changes" : "Create prediction"}
                </button>
                <Link
                  href="/admin/predictions"
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                >
                  Cancel
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
