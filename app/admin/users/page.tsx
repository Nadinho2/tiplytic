import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { UsersClient } from "./users-client";

export default async function Page() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  return <UsersClient />;
}

