import "server-only";

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function Page() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID;
  if (!userId || !adminId || userId !== adminId) redirect("/dashboard?error=403");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Predictions</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Acca builder</h1>
        <p className="mt-2 text-sm text-muted">
          Build and share accumulator slips using today&apos;s predictions.
        </p>
      </div>

      <Card className="bg-[#0D1320]">
        <CardHeader>
          <div className="text-sm font-semibold text-foreground">Open builder</div>
          <div className="mt-1 text-sm text-muted">
            The acca builder runs in the user dashboard experience.
          </div>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/accumulator"
            className="inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3B82F6]/90"
          >
            Go to Acca Builder
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

