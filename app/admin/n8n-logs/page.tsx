import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { N8nLogsClient } from "./n8n-logs-client";

export default async function Page() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  return <N8nLogsClient />;
}

