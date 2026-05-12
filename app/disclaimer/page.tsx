import { Container } from "@/components/ui/container";

export default function Page() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/70 p-6">
        <p className="text-sm font-medium text-accent">Disclaimer</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Informational use only
        </h1>

        <div className="mt-6 space-y-4 text-sm text-muted">
          <p>
            TipLytic provides sports-related information, analytics, and community predictions for
            educational and entertainment purposes. Nothing on TipLytic should be considered
            professional betting advice, financial advice, or a guarantee of results.
          </p>

          <h2 className="text-base font-semibold text-foreground">No Guarantee</h2>
          <p>
            Sports outcomes are unpredictable. Past performance, trends, or statistics do not
            guarantee future outcomes. You are solely responsible for how you interpret and use any
            information from the platform.
          </p>

          <h2 className="text-base font-semibold text-foreground">Community Content</h2>
          <p>
            Community picks and tipster submissions reflect the opinions of individual users. We do
            not endorse, verify, or guarantee community predictions. Always apply your own judgment.
          </p>

          <h2 className="text-base font-semibold text-foreground">Responsible Gambling</h2>
          <p>
            Betting involves risk and can be addictive. Do not wager money you cannot afford to
            lose. If you are experiencing gambling-related harm, seek help from local responsible
            gambling support services.
          </p>

          <h2 className="text-base font-semibold text-foreground">Age Restriction</h2>
          <p>
            The Service is intended for users aged 18+ (or the legal gambling age in your
            jurisdiction, whichever is higher).
          </p>

          <h2 className="text-base font-semibold text-foreground">Third-Party Links &amp; Services</h2>
          <p>
            TipLytic may reference or link to third-party services (e.g., payment processors). We
            are not responsible for third-party content, availability, or policies.
          </p>

          <h2 className="text-base font-semibold text-foreground">Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, TipLytic is not liable for any loss or damages
            arising from your use of the Service, including losses resulting from betting decisions.
          </p>
        </div>
      </div>
    </Container>
  );
}
