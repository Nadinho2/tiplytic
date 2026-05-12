import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { clerkAuthAppearance } from "@/components/auth/clerk-appearance";
import { BadgeGrid } from "@/components/ui/BadgeGrid";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default async function Page() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <Container className="flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card/70 p-6 text-center">
          <p className="text-sm font-medium text-accent">Profile</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Sign in to manage your account
          </h1>
          <p className="mt-3 text-sm text-muted">
            Your profile settings and subscription live here.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/sign-in" variant="primary">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <UserProfile appearance={clerkAuthAppearance} />
      <div className="mt-10 rounded-2xl border border-border bg-card/70 p-6">
        <div className="text-sm font-semibold text-foreground">Badges</div>
        <p className="mt-1 text-sm text-muted">
          Earn achievements as you predict and track your performance.
        </p>
        <div className="mt-5">
          <BadgeGrid />
        </div>
      </div>
    </Container>
  );
}
