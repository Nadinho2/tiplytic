import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { checkAndAwardBadges, getEarnedBadges } from "@/lib/badge-checker";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const award = url.searchParams.get("award") === "1";

  let newlyAwarded: string[] = [];
  if (award) {
    newlyAwarded = await checkAndAwardBadges(userId);
  }

  const earned = await getEarnedBadges(userId);

  return NextResponse.json({
    earned,
    newlyAwarded,
  });
}
