import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import { UserControls } from "@/components/auth/user-controls";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export async function MarketingNavbar() {
  const { userId } = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <Link href="/#community" className="hover:text-foreground">
            Community
          </Link>
          <Link href="/#leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/#pricing" className="hover:text-foreground">
            Pricing
          </Link>

          <div className="ml-2 flex items-center gap-3">
            {userId ? (
              <>
                <ButtonLink href="/dashboard" variant="primary" size="sm">
                  Dashboard
                </ButtonLink>
                <UserControls />
              </>
            ) : (
              <>
                <ButtonLink href="/sign-in" variant="ghost" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/sign-up" variant="primary" size="sm">
                  Join free
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
        <div className="flex items-center gap-3 md:hidden">
          {userId ? (
            <>
              <ButtonLink href="/dashboard" variant="primary" size="sm">
                Dashboard
              </ButtonLink>
              <UserControls />
            </>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" variant="primary" size="sm">
                Join
              </ButtonLink>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
