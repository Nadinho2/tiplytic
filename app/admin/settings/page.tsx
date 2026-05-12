import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SettingsClient } from "./settings-client";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  const sp = (await searchParams) ?? {};
  const tab = sp.tab ? String(sp.tab) : "flags";

  return <SettingsClient initialTab={tab} />;
}

