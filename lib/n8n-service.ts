import "server-only";

import { resend, SENDER_EMAIL } from "@/lib/resend";
import { createServiceClient } from "@/lib/admin";

type Tier = "free" | "basic" | "pro" | "elite";
type RiskLevel = "low" | "medium" | "high";

type N8nPrediction = {
  match_title?: string;
  home_team?: string;
  away_team?: string;
  league?: string;
  prediction_type?: string;
  tip?: string;
  odds?: number;
  confidence_score?: number;
  confidence?: number;
  risk_level?: string;
  match_date?: string;
  tier_required?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function normalizeTier(value: unknown): Tier {
  const v = String(value ?? "free").toLowerCase();
  if (v === "elite") return "elite";
  if (v === "pro") return "pro";
  if (v === "basic") return "basic";
  return "free";
}

function normalizeRisk(value: unknown): RiskLevel {
  const v = String(value ?? "medium").toLowerCase();
  if (v === "low") return "low";
  if (v === "high") return "high";
  return "medium";
}

function normalizePrediction(input: unknown): N8nPrediction | null {
  if (!isRecord(input)) return null;

  const matchTitle = asString(input.match_title);
  const homeTeam = asString(input.home_team);
  const awayTeam = asString(input.away_team);
  const league = asString(input.league);
  const predictionType = asString(input.prediction_type);
  const tip = asString(input.tip);
  const matchDate = asString(input.match_date);

  const odds = asNumber(input.odds);
  const confidenceScore = asNumber(input.confidence_score);
  const confidence = asNumber(input.confidence);
  const riskLevel = asString(input.risk_level);
  const tierRequired = asString(input.tier_required);

  return {
    match_title: matchTitle ?? undefined,
    home_team: homeTeam ?? undefined,
    away_team: awayTeam ?? undefined,
    league: league ?? undefined,
    prediction_type: predictionType ?? undefined,
    tip: tip ?? undefined,
    odds: odds ?? undefined,
    confidence_score: confidenceScore ?? undefined,
    confidence: confidence ?? undefined,
    risk_level: riskLevel ?? undefined,
    match_date: matchDate ?? undefined,
    tier_required: tierRequired ?? undefined,
  };
}

export async function fetchPredictionsFromN8N() {
  const url = requiredEnv("N8N_WEBHOOK_URL");
  const secret = requiredEnv("N8N_WEBHOOK_SECRET");

  const now = new Date();
  const date = now.toISOString().split("T")[0];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tiplytic-secret": secret,
    },
    body: JSON.stringify({
      action: "fetch_predictions",
      date,
      requested_at: now.toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as unknown;
}

export async function savePredictionsToSupabase(predictions: unknown[]) {
  const supabase = createServiceClient();

  if (!predictions.length) {
    return { saved: 0, skipped: 0, errors: [] as string[] };
  }

  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of predictions) {
    const prediction = normalizePrediction(raw);
    if (!prediction) {
      skipped += 1;
      continue;
    }

    const homeTeam = (prediction.home_team ?? "").trim() || null;
    const awayTeam = (prediction.away_team ?? "").trim() || null;
    const matchTitle =
      (prediction.match_title ?? "").trim() ||
      (homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : "");

    const tip = (prediction.tip ?? "").trim();
    const matchDate = (prediction.match_date ?? "").trim();
    if (!matchTitle) {
      errors.push("Invalid prediction: missing match_title/home_team/away_team");
      continue;
    }
    if (!tip || !matchDate) {
      errors.push(`Invalid prediction: missing tip or match_date (${matchTitle})`);
      continue;
    }

    const league = (prediction.league ?? "").trim() || null;
    const predictionType = (prediction.prediction_type ?? "").trim() || "1X2";
    const odds = prediction.odds != null && prediction.odds >= 1.01 ? prediction.odds : null;
    const confidence =
      prediction.confidence_score != null
        ? Math.max(0, Math.min(100, Math.floor(prediction.confidence_score)))
        : prediction.confidence != null
          ? Math.max(0, Math.min(100, Math.floor(prediction.confidence)))
          : null;
    const riskLevel = normalizeRisk(prediction.risk_level);
    const tierRequired = normalizeTier(prediction.tier_required);

    try {
      const { data: existing } = await supabase
        .from("predictions")
        .select("id")
        .eq("match_date", matchDate)
        .eq("match_title", matchTitle)
        .maybeSingle<{ id: string }>();

      if (existing?.id) {
        skipped += 1;
        continue;
      }

      const insertRow: Record<string, unknown> = {
        match_title: matchTitle,
        league,
        home_team: homeTeam,
        away_team: awayTeam,
        prediction_type: predictionType,
        tip,
        odds,
        confidence,
        risk_level: riskLevel,
        match_date: matchDate,
        tier_required: tierRequired,
        is_admin_pick: false,
        source: "n8n",
        result: "pending",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("predictions").insert(insertRow as never);
      if (error) {
        errors.push(`Failed to save ${matchTitle}: ${error.message}`);
        continue;
      }

      saved += 1;
    } catch (e) {
      errors.push(`Error processing ${matchTitle}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return { saved, skipped, errors };
}

export async function logCronRun(
  status: "success" | "failed",
  recordsProcessed: number,
  details?: Record<string, unknown>,
) {
  const supabase = createServiceClient();
  try {
    await supabase.from("cron_logs").insert({
      job: "daily_predictions_fetch",
      user_id: "system",
      status,
      details: { recordsProcessed, ...(details ?? {}) },
      created_at: new Date().toISOString(),
    });
  } catch {}
}

export async function notifyAdminOfCronFailure(message: string) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;

  try {
    await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: "TipLytic — Daily prediction fetch failed",
      html: `
        <h2>Daily Prediction Fetch Failed</h2>
        <p>The scheduled cron job failed to fetch predictions from N8N.</p>
        <p><strong>Error:</strong> ${String(message)}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><a href="https://tiplytic.vercel.app/admin/n8n-logs">Open N8N Logs</a></p>
      `,
    });
  } catch {}
}
