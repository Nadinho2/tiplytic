Your N8N webhook should return either a single prediction object, an array of prediction objects, or an object containing `predictions` / `data` arrays.

**Prediction object shape**

```json
{
  "match_title": "Manchester City vs Arsenal",
  "home_team": "Manchester City",
  "away_team": "Arsenal",
  "league": "EPL",
  "prediction_type": "Over/Under",
  "tip": "Over 2.5",
  "odds": 1.85,
  "confidence_score": 74,
  "risk_level": "medium",
  "match_date": "2026-05-08T20:00:00.000Z",
  "tier_required": "basic"
}
```

**Allowed `prediction_type` examples**
- `1X2`
- `Over/Under`
- `BTTS`
- `Handicap`

**Allowed `risk_level`**
- `low`
- `medium`
- `high`

**Allowed `tier_required`**
- `free`
- `basic`
- `pro`
- `elite`

**Multiple predictions (array)**

```json
[
  { "match_title": "Match A", "home_team": "A", "away_team": "B", "league": "EPL", "prediction_type": "1X2", "tip": "1", "match_date": "2026-05-08T20:00:00.000Z" },
  { "match_title": "Match C", "home_team": "C", "away_team": "D", "league": "EPL", "prediction_type": "BTTS", "tip": "Yes", "match_date": "2026-05-08T20:00:00.000Z" }
]
```

**Multiple predictions (wrapped)**

```json
{
  "predictions": [
    { "match_title": "Match A", "home_team": "A", "away_team": "B", "league": "EPL", "prediction_type": "1X2", "tip": "1", "match_date": "2026-05-08T20:00:00.000Z" }
  ]
}
```

