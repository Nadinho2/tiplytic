import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/(.*)",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSubscriptionFromClaims(claims: unknown) {
  if (!isRecord(claims)) return null;

  const publicMetadata = isRecord(claims.publicMetadata)
    ? claims.publicMetadata
    : isRecord(claims.public_metadata)
      ? claims.public_metadata
      : null;
  if (!publicMetadata) return null;

  const sub = isRecord(publicMetadata.subscription) ? publicMetadata.subscription : null;
  if (!sub) return null;

  const tier = String(sub.tier ?? "free").toLowerCase();
  const status = String(sub.status ?? "active").toLowerCase();
  const expiresAt =
    typeof sub.expiresAt === "string"
      ? sub.expiresAt
      : typeof sub.expires_at === "string"
        ? sub.expires_at
        : null;
  const trialEndsAt =
    typeof sub.trialEndsAt === "string"
      ? sub.trialEndsAt
      : typeof sub.trial_ends_at === "string"
        ? sub.trial_ends_at
        : null;

  return { tier, status, expires_at: expiresAt, trial_ends_at: trialEndsAt };
}

async function getSubscriptionStatus(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  const key = serviceRoleKey;

  async function fetchRow(select: string) {
    const url = new URL(`${supabaseUrl}/rest/v1/user_subscriptions`);
    url.searchParams.set("select", select);
    url.searchParams.set("clerk_user_id", `eq.${userId}`);
    url.searchParams.set("limit", "1");
    const resp = await fetch(url.toString(), {
      headers: new Headers({ apikey: key, Authorization: `Bearer ${key}` }),
      cache: "no-store",
    }).catch(() => null);
    if (!resp || !resp.ok) return null;
    const rows = (await resp.json().catch(() => null)) as Array<Record<string, unknown>> | null;
    return rows?.[0] ?? null;
  }

  const row =
    (await fetchRow("tier,status,expires_at,trial_ends_at")) ??
    (await fetchRow("tier,status,expires_at"));
  if (!row) return null;
  return {
    tier: String(row.tier ?? "free").toLowerCase(),
    status: String(row.status ?? "active").toLowerCase(),
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    trial_ends_at: typeof row.trial_ends_at === "string" ? row.trial_ends_at : null,
  };
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/api/webhooks/n8n")) return;
  if (pathname.startsWith("/api/webhooks/paystack")) return;
  if (pathname === "/api/admin-pick") return;
  if (pathname === "/api/bankroll/settle") return;
  if (pathname.startsWith("/admin")) {
    const adminId = process.env.ADMIN_USER_ID;
    const { userId } = await auth();
    if (!adminId || !userId || userId !== adminId) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("error", "403");
      return NextResponse.redirect(url, { status: 307 });
    }
    await auth.protect();
    return;
  }
  if (isProtectedRoute(req)) {
    await auth.protect();

    if (pathname.startsWith("/dashboard") && !pathname.startsWith("/dashboard/subscription")) {
      const { userId, sessionClaims } = await auth();
      if (userId) {
        const sub = getSubscriptionFromClaims(sessionClaims) ?? (await getSubscriptionStatus(userId));
        if (sub) {
          const now = Date.now();
          const trialEnd = sub.trial_ends_at ?? (sub.status === "trialing" ? sub.expires_at : null);
          const isTrialEnded = sub.status === "trialing" && trialEnd ? new Date(trialEnd).getTime() < now : false;
          const expired =
            sub.status === "expired" ||
            sub.status === "cancelled" ||
            isTrialEnded ||
            (sub.expires_at ? new Date(sub.expires_at).getTime() < now : false);

          if (expired && sub.tier !== "free") {
            const url = req.nextUrl.clone();
            url.pathname = "/pricing";
            url.searchParams.set("expired", "true");
            return NextResponse.redirect(url, { status: 307 });
          }

          if (sub.status === "paused") {
            const url = req.nextUrl.clone();
            url.pathname = "/dashboard/subscription";
            url.searchParams.set("paused", "true");
            return NextResponse.redirect(url, { status: 307 });
          }
        }
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:css|js|json|jpg|jpeg|png|gif|svg|webp|ico|txt|woff|woff2)).*)",
    "/(api|trpc)(.*)",
  ],
  runtime: "nodejs",
};
