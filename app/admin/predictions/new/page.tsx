import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PredictionFormClient } from "./prediction-form-client";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  const sp = (await searchParams) ?? {};
  const editId = sp.edit ? String(sp.edit) : null;

  return <PredictionFormClient editId={editId} />;
}

