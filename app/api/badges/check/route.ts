import "server-only";

import { NextResponse } from "next/server";

import { checkAndAwardBadges } from "@/lib/badge-checker";

type Body = { userId: string };

export async function POST(request: Request) {
  const secret = process.env.BADGE_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = request.headers.get("x-webhook-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await request.json()) as Body;
  if (!body.userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const newlyAwarded = await checkAndAwardBadges(body.userId);
  return NextResponse.json({ ok: true, newlyAwarded });
}
