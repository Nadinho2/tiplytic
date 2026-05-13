import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/admin";
import { fetchOddsForMatch } from "@/lib/odds-service";

export const runtime = "nodejs";

function buildBestOddsByTip(cached: Record<string, unknown>): Record<string, number> {
  const map: Record<string, number> = {};
  if (cached.home_odds) map["Home Win"] = Number(cached.home_odds);
  if (cached.draw_odds) map["Draw"] = Number(cached.draw_odds);
  if (cached.away_odds) map["Away Win"] = Number(cached.away_odds);
  if (cached.over25_odds) map["Over 2.5"] = Number(cached.over25_odds);
  if (cached.under25_odds) map["Under 2.5"] = Number(cached.under25_odds);
  if (cached.btts_yes_odds) map["BTTS Yes"] = Number(cached.btts_yes_odds);
  if (cached.btts_no_odds) map["BTTS No"] = Number(cached.btts_no_odds);
  return map;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("match_id");

  if (!matchId) {
    return NextResponse.json({ error: "match_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Step 1: Check odds cache first — avoid unnecessary API calls
  const { data: cached } = await supabase
    .from("odds_cache")
    .select("*")
    .eq("match_id", matchId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      success: true,
      available: true,
      cached: true,
      home_odds: cached.home_odds,
      draw_odds: cached.draw_odds,
      away_odds: cached.away_odds,
      over25_odds: cached.over25_odds,
      under25_odds: cached.under25_odds,
      btts_yes_odds: cached.btts_yes_odds,
      btts_no_odds: cached.btts_no_odds,
      bookmakers: cached.bookmakers,
      best_odds_by_tip: buildBestOddsByTip(cached as Record<string, unknown>),
      fetched_at: cached.fetched_at,
    });
  }

  // Step 2: Fetch match details from Supabase
  const { data: match, error: matchError } = await supabase
    .from("predictions")
    .select("id, home_team, away_team, league, match_date")
    .eq("id", matchId)
    .maybeSingle<{
      id: string;
      home_team: string | null;
      away_team: string | null;
      league: string | null;
      match_date: string | null;
    }>();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (!match.home_team || !match.away_team || !match.league || !match.match_date) {
    return NextResponse.json({
      success: true,
      available: false,
      message: "Match data incomplete. You may enter odds manually.",
      manual_input_allowed: true,
    });
  }

  // Step 3: Fetch from Odds API
  const odds = await fetchOddsForMatch(
    match.home_team,
    match.away_team,
    match.league,
    match.match_date,
  );

  if (!odds) {
    // Odds not available for this match/league
    return NextResponse.json({
      success: true,
      available: false,
      message: "Odds not available for this match. You may enter odds manually.",
      manual_input_allowed: true,
    });
  }

  // Step 4: Save to cache (expires in 2 hours)
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("odds_cache")
    .upsert(
      {
        match_id: matchId,
        home_odds: odds.home_odds,
        draw_odds: odds.draw_odds,
        away_odds: odds.away_odds,
        over25_odds: odds.over25_odds,
        under25_odds: odds.under25_odds,
        btts_yes_odds: odds.btts_yes_odds,
        btts_no_odds: odds.btts_no_odds,
        bookmakers: odds.bookmakers,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "match_id" },
    );

  // Step 5: Also update the predictions table with the fetched odds
  await supabase
    .from("predictions")
    .update({
      home_odds: odds.home_odds,
      draw_odds: odds.draw_odds,
      away_odds: odds.away_odds,
      over25_odds: odds.over25_odds,
      under25_odds: odds.under25_odds,
      btts_yes_odds: odds.btts_yes_odds,
      btts_no_odds: odds.btts_no_odds,
      odds_fetched_at: new Date().toISOString(),
      odds_source: odds.source,
    })
    .eq("id", matchId);

  return NextResponse.json({
    success: true,
    available: true,
    cached: false,
    ...odds,
    fetched_at: new Date().toISOString(),
  });
}
