import "server-only";

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { createServiceClient, requireAdmin } from "@/lib/admin";

function clampInt(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function asLower(v: string | null) {
  return String(v ?? "").trim().toLowerCase();
}

function isMissingTableError(message: string, table: string) {
  const m = message.toLowerCase();
  if (!m.includes(table.toLowerCase())) return false;
  if (m.includes("schema cache")) return true;
  if (m.includes("could not find the table")) return true;
  if (m.includes("relation") && m.includes("does not exist")) return true;
  return false;
}

async function usersById(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, { name: string; email: string | null; username: string | null }>();
  if (!uniq.length) return map;

  const clerk = await clerkClient();
  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        try {
          const u = await clerk.users.getUser(id);
          const email =
            u.primaryEmailAddress?.emailAddress ||
            u.emailAddresses?.[0]?.emailAddress ||
            null;
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || id;
          return { id, name, email, username: u.username ?? null };
        } catch {
          return { id, name: id, email: null, username: null };
        }
      }),
    );
    for (const r of rows) map.set(r.id, { name: r.name, email: r.email, username: r.username });
  }
  return map;
}

type SubscriptionRow = {
  clerk_user_id: string;
  tier: string | null;
  status: string | null;
  interval?: string | null;
  expires_at?: string | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  paystack_customer_code?: string | null;
  paystack_subscription_code?: string | null;
};

type PaymentRow = {
  reference?: string | null;
  user_id?: string | null;
  email?: string | null;
  tier?: string | null;
  interval?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
};

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const tab = asLower(url.searchParams.get("tab")) === "revenue" ? "revenue" : "subscriptions";
    const page = clampInt(url.searchParams.get("page"), 0);
    const pageSize = 25;

    const supabase = createServiceClient();

    if (tab === "revenue") {
      const status = asLower(url.searchParams.get("status"));
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      let q = supabase
        .from("payments")
        .select("reference,user_id,email,tier,interval,amount,status,created_at,paid_at", { count: "exact" });

      if (status && (status === "success" || status === "failed" || status === "pending" || status === "trial")) {
        q = q.eq("status", status);
      }
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);

      q = q.order("created_at", { ascending: false });
      const fromIdx = page * pageSize;
      const toIdx = fromIdx + pageSize - 1;

      const { data, count, error } = await q.range(fromIdx, toIdx);
      if (error) {
        if (isMissingTableError(error.message, "payments")) {
          return NextResponse.json(
            {
              tab,
              summary: null,
              payments: [],
              page,
              pageSize,
              total: 0,
              tableMissing: true,
              error: "payments table is missing. Create public.payments in Supabase and reload schema cache.",
            },
            { status: 200 },
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const rows = (data as PaymentRow[] | null) ?? [];
      const ids = rows.map((r) => String(r.user_id ?? "")).filter(Boolean);
      const clerkMap = await usersById(ids);

      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      const last7 = new Date(today);
      last7.setUTCDate(last7.getUTCDate() - 7);

      const summarySource = rows.length < 5000
        ? rows
        : rows.slice(0, 5000);

      let revenueToday = 0;
      let revenueMonth = 0;
      let revenueLast7Days = 0;
      let successCount = 0;
      let failedCount = 0;

      for (const r of summarySource) {
        const createdAt = typeof r.created_at === "string" ? r.created_at : null;
        const statusVal = String(r.status ?? "").toLowerCase();
        const amt = r.amount ?? 0;
        if (statusVal === "success") {
          successCount += 1;
          if (createdAt && createdAt >= today.toISOString()) revenueToday += amt;
          if (createdAt && createdAt >= month.toISOString()) revenueMonth += amt;
          if (createdAt && createdAt >= last7.toISOString()) revenueLast7Days += amt;
        }
        if (statusVal === "failed") failedCount += 1;
      }

      const payments = rows.map((r) => {
        const userId = String(r.user_id ?? "");
        const clerk = userId ? clerkMap.get(userId) ?? null : null;
        return {
          ...r,
          user: clerk ? { id: userId, ...clerk } : userId ? { id: userId, name: userId, email: null, username: null } : null,
        };
      });

      return NextResponse.json({
        tab,
        summary: {
          revenueToday,
          revenueMonth,
          revenueLast7Days,
          successCount,
          failedCount,
        },
        payments,
        page,
        pageSize,
        total: count ?? 0,
      });
    }

    const tier = asLower(url.searchParams.get("tier"));
    const status = asLower(url.searchParams.get("status"));

    let q = supabase
      .from("user_subscriptions")
      .select(
        "clerk_user_id,tier,status,interval,expires_at,trial_ends_at,created_at,updated_at,paystack_customer_code,paystack_subscription_code",
        { count: "exact" },
      );

    if (tier && (tier === "free" || tier === "basic" || tier === "pro" || tier === "elite")) q = q.eq("tier", tier);
    if (status && status !== "all") q = q.eq("status", status);

    q = q.order("updated_at", { ascending: false, nullsFirst: false });
    const fromIdx = page * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    const { data, count, error } = await q.range(fromIdx, toIdx);
    if (error) {
      if (isMissingTableError(error.message, "user_subscriptions")) {
        return NextResponse.json(
          {
            tab,
            summary: null,
            subscriptions: [],
            page,
            pageSize,
            total: 0,
            tableMissing: true,
            error: "user_subscriptions table is missing. Create public.user_subscriptions in Supabase and reload schema cache.",
          },
          { status: 200 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data as SubscriptionRow[] | null) ?? [];
    const ids = rows.map((r) => String(r.clerk_user_id ?? "")).filter(Boolean);
    const clerkMap = await usersById(ids);

    const now = Date.now();
    const soon = now + 7 * 86_400_000;
    let activePaid = 0;
    let trialing = 0;
    let expiringSoon = 0;

    for (const r of rows) {
      const t = String(r.tier ?? "free").toLowerCase();
      const s = String(r.status ?? "active").toLowerCase();
      if (t !== "free" && (s === "active" || s === "trialing")) activePaid += 1;
      if (s === "trialing") trialing += 1;
      const exp = typeof r.expires_at === "string" ? new Date(r.expires_at).getTime() : null;
      if (exp != null && exp > now && exp <= soon) expiringSoon += 1;
    }

    const subscriptions = rows.map((r) => {
      const userId = String(r.clerk_user_id ?? "");
      const clerk = userId ? clerkMap.get(userId) ?? null : null;
      return {
        ...r,
        user: clerk ? { id: userId, ...clerk } : userId ? { id: userId, name: userId, email: null, username: null } : null,
      };
    });

    return NextResponse.json({
      tab,
      summary: { activePaid, trialing, expiringSoon },
      subscriptions,
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}
