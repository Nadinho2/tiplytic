import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PickStatus = "Won" | "Lost" | "Pending";

const myPicks: Array<{
  id: number;
  match: string;
  market: string;
  pick: string;
  odds: string;
  status: PickStatus;
  stake: string;
}> = [
  {
    id: 1,
    match: "Arsenal vs Chelsea",
    market: "Match Odds",
    pick: "Arsenal to win",
    odds: "1.85",
    status: "Won",
    stake: "₦5,000",
  },
  {
    id: 2,
    match: "Lakers vs Nuggets",
    market: "Over/Under",
    pick: "Over 215.5",
    odds: "1.90",
    status: "Pending",
    stake: "₦2,500",
  },
  {
    id: 3,
    match: "Djokovic vs Alcaraz",
    market: "Set Betting",
    pick: "Alcaraz 3-1",
    odds: "3.50",
    status: "Lost",
    stake: "₦1,000",
  },
  {
    id: 4,
    match: "Real Madrid vs Barcelona",
    market: "Both Teams to Score",
    pick: "Yes",
    odds: "1.65",
    status: "Won",
    stake: "₦10,000",
  },
];

function getStatusVariant(status: PickStatus) {
  if (status === "Won") return "success";
  if (status === "Lost") return "danger";
  return "warning";
}

export function RecentPicks() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold">Your Recent Picks</h3>
        <p className="mt-1 text-sm text-muted">
          Latest predictions tracked in your account.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
            <div className="col-span-6">Match & Pick</div>
            <div className="col-span-2 text-right">Odds</div>
            <div className="col-span-2 text-right">Stake</div>
            <div className="col-span-2 text-right">Result</div>
          </div>
          <div className="divide-y divide-border bg-card/40">
            {myPicks.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-12 items-center gap-y-2 px-4 py-3 text-sm"
              >
                <div className="col-span-12 sm:col-span-6">
                  <div className="font-medium">{p.match}</div>
                  <div className="text-xs text-muted">
                    {p.market} • {p.pick}
                  </div>
                </div>
                <div className="col-span-4 text-left font-medium text-foreground sm:col-span-2 sm:text-right">
                  {p.odds}
                </div>
                <div className="col-span-4 text-left text-muted sm:col-span-2 sm:text-right">
                  {p.stake}
                </div>
                <div className="col-span-4 flex justify-end sm:col-span-2">
                  <Badge variant={getStatusVariant(p.status)}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
