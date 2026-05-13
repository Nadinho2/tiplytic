import "server-only";

const ODDS_API_KEY = process.env.ODDS_API_KEY || "";
const ODDS_API_BASE = process.env.ODDS_API_BASE || "https://api.the-odds-api.com/v4";

// Map our league names to The Odds API sport keys
const LEAGUE_TO_SPORT_KEY: Record<string, string> = {
  EPL: "soccer_epl",
  "La Liga": "soccer_spain_la_liga",
  "Champions League": "soccer_uefa_champs_league",
  "Serie A": "soccer_italy_serie_a",
  Bundesliga: "soccer_germany_bundesliga",
  "Ligue 1": "soccer_france_ligue_one",
  Eredivisie: "soccer_netherlands_eredivisie",
  "Europa League": "soccer_uefa_europa_league",
  NPFL: "soccer_nigeria",
};

export interface OddsResult {
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over25_odds: number | null;
  under25_odds: number | null;
  btts_yes_odds: number | null;
  btts_no_odds: number | null;
  best_odds_by_tip: Record<string, number>;
  bookmakers: BookmakerOdds[];
  source: string;
}

export interface BookmakerOdds {
  name: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  over25: number | null;
  under25: number | null;
}

export async function fetchOddsForMatch(
  homeTeam: string,
  awayTeam: string,
  league: string,
  _matchDate: string,
): Promise<OddsResult | null> {
  const sportKey = LEAGUE_TO_SPORT_KEY[league];

  if (!sportKey || !ODDS_API_KEY) {
    // League not supported by API or no API key — return null, form will show manual input fallback
    return null;
  }

  try {
    // Fetch all upcoming odds for this sport
    const url = new URL(`${ODDS_API_BASE}/sports/${sportKey}/odds`);
    url.searchParams.set("apiKey", ODDS_API_KEY);
    url.searchParams.set("regions", "uk,eu,us");
    url.searchParams.set("markets", "h2h,totals");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const response = await fetch(url.toString(), {
      next: { revalidate: 7200 }, // Cache for 2 hours
    });

    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }

    const events = await response.json();

    // Find the matching event by team names (fuzzy match)
    const matchedEvent = events.find((event: Record<string, unknown>) => {
      const homeMatch =
        normaliseTeamName(String(event.home_team ?? "")) === normaliseTeamName(homeTeam);
      const awayMatch =
        normaliseTeamName(String(event.away_team ?? "")) === normaliseTeamName(awayTeam);
      return homeMatch && awayMatch;
    });

    if (!matchedEvent) {
      return null;
    }

    // Extract odds from all bookmakers
    const bookmakers: BookmakerOdds[] = [];
    const allHomeOdds: number[] = [];
    const allDrawOdds: number[] = [];
    const allAwayOdds: number[] = [];
    const allOver25Odds: number[] = [];
    const allUnder25Odds: number[] = [];
    const allBttsYesOdds: number[] = [];
    const allBttsNoOdds: number[] = [];

    for (const bookmaker of matchedEvent.bookmakers || []) {
      const bm: BookmakerOdds = {
        name: bookmaker.title,
        home: null,
        draw: null,
        away: null,
        over25: null,
        under25: null,
      };

      for (const market of bookmaker.markets || []) {
        if (market.key === "h2h") {
          for (const outcome of market.outcomes) {
            if (outcome.name === matchedEvent.home_team) {
              bm.home = outcome.price;
              allHomeOdds.push(outcome.price);
            } else if (outcome.name === matchedEvent.away_team) {
              bm.away = outcome.price;
              allAwayOdds.push(outcome.price);
            } else if (outcome.name === "Draw") {
              bm.draw = outcome.price;
              allDrawOdds.push(outcome.price);
            }
          }
        }

        if (market.key === "totals") {
          for (const outcome of market.outcomes) {
            if (outcome.name === "Over" && outcome.point === 2.5) {
              bm.over25 = outcome.price;
              allOver25Odds.push(outcome.price);
            }
            if (outcome.name === "Under" && outcome.point === 2.5) {
              bm.under25 = outcome.price;
              allUnder25Odds.push(outcome.price);
            }
          }
        }

        if (market.key === "btts") {
          for (const outcome of market.outcomes) {
            if (outcome.name === "Yes") {
              allBttsYesOdds.push(outcome.price);
            }
            if (outcome.name === "No") {
              allBttsNoOdds.push(outcome.price);
            }
          }
        }
      }

      bookmakers.push(bm);
    }

    // Use BEST available odds across all bookmakers
    const home_odds = allHomeOdds.length > 0 ? Math.max(...allHomeOdds) : null;
    const draw_odds = allDrawOdds.length > 0 ? Math.max(...allDrawOdds) : null;
    const away_odds = allAwayOdds.length > 0 ? Math.max(...allAwayOdds) : null;
    const over25_odds = allOver25Odds.length > 0 ? Math.max(...allOver25Odds) : null;
    const under25_odds = allUnder25Odds.length > 0 ? Math.max(...allUnder25Odds) : null;
    const btts_yes_odds = allBttsYesOdds.length > 0 ? Math.max(...allBttsYesOdds) : null;
    const btts_no_odds = allBttsNoOdds.length > 0 ? Math.max(...allBttsNoOdds) : null;

    // Build a tip → odds lookup for the form
    const best_odds_by_tip: Record<string, number> = {};
    if (home_odds) best_odds_by_tip["Home Win"] = home_odds;
    if (draw_odds) best_odds_by_tip["Draw"] = draw_odds;
    if (away_odds) best_odds_by_tip["Away Win"] = away_odds;
    if (over25_odds) best_odds_by_tip["Over 2.5"] = over25_odds;
    if (under25_odds) best_odds_by_tip["Under 2.5"] = under25_odds;
    if (btts_yes_odds) best_odds_by_tip["BTTS Yes"] = btts_yes_odds;
    if (btts_no_odds) best_odds_by_tip["BTTS No"] = btts_no_odds;

    return {
      home_odds,
      draw_odds,
      away_odds,
      over25_odds,
      under25_odds,
      btts_yes_odds,
      btts_no_odds,
      best_odds_by_tip,
      bookmakers,
      source: "the-odds-api",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[Odds Service] Error fetching odds:", message);
    return null;
  }
}

// Normalise team names for fuzzy matching
// e.g. "Man City" matches "Manchester City"
function normaliseTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/manchester/g, "man")
    .replace(/fc |afc |cf /g, "")
    .replace(/united/g, "utd")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}
