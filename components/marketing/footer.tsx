import { auth } from "@clerk/nextjs/server";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";

export async function MarketingFooter() {
  const { userId } = await auth();

  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-muted sm:hidden">
            © {new Date().getFullYear()} TipLytic
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/#community" className="hover:text-foreground">
            Community
          </Link>
          <Link href="/#leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/#pricing" className="hover:text-foreground">
            Pricing
          </Link>
          {userId ? (
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-foreground">
                Sign in
              </Link>
              <Link href="/sign-up" className="hover:text-foreground">
                Join
              </Link>
            </>
          )}
        </div>
        <p className="hidden text-xs text-muted sm:block">
          © {new Date().getFullYear()} TipLytic
        </p>
      </Container>
    </footer>
  );
}
