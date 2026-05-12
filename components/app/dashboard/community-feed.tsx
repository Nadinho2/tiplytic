import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const communityPicks = [
  {
    id: 1,
    tipster: "NeonEdge",
    match: "Man City vs Arsenal",
    pick: "Man City to win",
    odds: "1.75",
    time: "2h ago",
  },
  {
    id: 2,
    tipster: "GreenPulse",
    match: "Chiefs vs 49ers",
    pick: "Chiefs -3.5",
    odds: "1.90",
    time: "4h ago",
  },
  {
    id: 3,
    tipster: "UnitCraft",
    match: "Sinner vs Medvedev",
    pick: "Over 3.5 Sets",
    odds: "1.55",
    time: "5h ago",
  },
];

export function CommunityFeed() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Community Feed</h3>
            <p className="mt-1 text-sm text-muted">
              Live picks from tipsters you follow.
            </p>
          </div>
          <Badge variant="success">Live</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {communityPicks.map((pick) => (
            <div
              key={pick.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4 transition hover:bg-white/5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-accent">@{pick.tipster}</span>
                  <span className="text-xs text-muted">{pick.time}</span>
                </div>
                <div className="mt-1 font-medium">{pick.match}</div>
                <div className="text-sm text-muted">{pick.pick}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Odds</div>
                <div className="font-semibold text-foreground">{pick.odds}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ButtonLink
            href="/dashboard/community"
            variant="secondary"
            className="w-full"
          >
            Browse all predictions
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}
