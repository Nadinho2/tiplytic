import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { Container } from "@/components/ui/container";

import { SubscriptionClient } from "./subscription-client";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createServiceClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type SubRow = {
  tier: string | null;
  status: string | null;
  expires_at: string | null;
};

type PaymentRow = {
  amount: number | null;
  tier: string | null;
  interval: string | null;
  status: string | null;
  created_at: string | null;
  reference?: string | null;
};

export default async function Page() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createServiceClient();

  let subscription: SubRow = { tier: "free", status: "active", expires_at: null };
  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("tier,status,expires_at")
      .eq("clerk_user_id", userId)
      .maybeSingle<SubRow>();
    if (data) subscription = data;
  } catch {}

  let payments: PaymentRow[] = [];
  try {
    const { data } = await supabase
      .from("payments")
      .select("amount,tier,interval,status,created_at,reference")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    payments = (data as PaymentRow[] | null) ?? [];
  } catch {}

  let usageToday = 0;
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString();
    const { count } = await supabase
      .from("community_predictions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end);
    usageToday = count ?? 0;
  } catch {}

  return (
    <Container className="py-10">
      <SubscriptionClient subscription={subscription} payments={payments} usageToday={usageToday} />
    </Container>
  );
}

