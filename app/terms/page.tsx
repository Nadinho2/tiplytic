import { Container } from "@/components/ui/container";

export default function Page() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/70 p-6">
        <p className="text-sm font-medium text-accent">Terms</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Terms of service
        </h1>
        <p className="mt-3 text-sm text-muted">
          Last updated: May 12, 2026
        </p>

        <div className="mt-6 space-y-4 text-sm text-muted">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of TipLytic
            (&ldquo;TipLytic&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;),
            including our website, apps, dashboards, and related services (collectively, the
            &ldquo;Service&rdquo;). By using the Service, you agree to these Terms.
          </p>

          <h2 className="text-base font-semibold text-foreground">1. Eligibility</h2>
          <p>
            You must be at least 18 years old (or the legal gambling age in your jurisdiction,
            whichever is higher) to use the Service. You are responsible for complying with all
            applicable laws where you live.
          </p>

          <h2 className="text-base font-semibold text-foreground">2. No Betting Advice</h2>
          <p>
            TipLytic provides informational content and community discussion. We do not provide
            financial, investment, or betting advice. Any picks, tips, odds, or analytics are not
            guarantees of outcome. You are solely responsible for your decisions and any losses.
          </p>

          <h2 className="text-base font-semibold text-foreground">3. Accounts</h2>
          <p>
            When you create an account, you agree to provide accurate information and to keep your
            account secure. You are responsible for all activity that occurs under your account.
          </p>

          <h2 className="text-base font-semibold text-foreground">4. Subscriptions &amp; Payments</h2>
          <p>
            Certain features may require a paid subscription. Prices, billing cycles, and available
            plans may change. Where supported, you may cancel or pause your subscription through the
            Service. Unless required by law, payments are non-refundable once processed.
          </p>

          <h2 className="text-base font-semibold text-foreground">5. Community Content</h2>
          <p>
            You may be able to submit community predictions, comments, or other content
            (&ldquo;User Content&rdquo;). You retain ownership of your User Content, but you grant us
            a worldwide, non-exclusive, royalty-free license to host, store, display, and distribute
            it as needed to operate the Service.
          </p>
          <p>
            You agree not to post content that is illegal, harmful, abusive, misleading, infringing,
            or that violates the rights of others. We may remove content or restrict accounts at our
            discretion.
          </p>

          <h2 className="text-base font-semibold text-foreground">6. Acceptable Use</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Do not attempt to exploit, scrape, or reverse engineer the Service.</li>
            <li>Do not interfere with security, availability, or performance.</li>
            <li>Do not use the Service for fraud, impersonation, or illegal activity.</li>
            <li>Do not upload malware, spam, or abusive automated traffic.</li>
          </ul>

          <h2 className="text-base font-semibold text-foreground">7. Third-Party Services</h2>
          <p>
            We may integrate third-party services (e.g., payment providers, authentication, email).
            Your use of those services may be subject to their separate terms and policies.
          </p>

          <h2 className="text-base font-semibold text-foreground">8. Intellectual Property</h2>
          <p>
            The Service, including its design, text, graphics, logos, and software, is owned by
            TipLytic or our licensors and is protected by applicable intellectual property laws.
          </p>

          <h2 className="text-base font-semibold text-foreground">9. Disclaimers</h2>
          <p>
            The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
            We make no warranties of any kind, express or implied, including warranties of accuracy,
            reliability, merchantability, fitness for a particular purpose, or non-infringement.
          </p>

          <h2 className="text-base font-semibold text-foreground">10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, TipLytic will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss of profits or data,
            arising out of or related to your use of the Service.
          </p>

          <h2 className="text-base font-semibold text-foreground">11. Termination</h2>
          <p>
            We may suspend or terminate access to the Service at any time if we believe you have
            violated these Terms or if required for security or legal reasons.
          </p>

          <h2 className="text-base font-semibold text-foreground">12. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the Federal Republic of Nigeria, without regard
            to conflict of law principles.
          </p>

          <h2 className="text-base font-semibold text-foreground">13. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
            <a className="text-accent underline underline-offset-4" href="mailto:support@tiplytic.com">
              support@tiplytic.com
            </a>
            .
          </p>
        </div>
      </div>
    </Container>
  );
}
