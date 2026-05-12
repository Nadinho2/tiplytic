import "server-only";

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { createServiceClient, requireAdmin } from "@/lib/admin";

type ClerkUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt?: number;
  lastSignInAt?: number | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }> | null;
};

function asLower(v: string | null) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeTier(v: unknown) {
  const s = String(v ?? "").toLowerCase();
  if (s === "elite") return "elite";
  if (s === "pro") return "pro";
  if (s === "basic") return "basic";
  return "free";
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const q = asLower(url.searchParams.get("q"));
    const tier = asLower(url.searchParams.get("tier"));
    const status = asLower(url.searchParams.get("status"));
    const page = Math.max(0, Math.floor(Number(url.searchParams.get("page") ?? "0")));
    const pageSize = 25;

    const supabase = createServiceClient();

    const { data: subsData } = await supabase
      .from("user_subscriptions")
      .select("clerk_user_id,tier,status,created_at,expires_at,updated_at")
      .limit(50_000);
    const subs =
      (subsData as Array<{
        clerk_user_id: string;
        tier: string | null;
        status: string | null;
        created_at: string | null;
        updated_at: string | null;
        expires_at: string | null;
      }> | null) ?? [];

    const subByUser = new Map<string, (typeof subs)[number]>();
    for (const s of subs) {
      subByUser.set(String(s.clerk_user_id), s);
    }

    const clerk = await clerkClient();
    const limit = pageSize;
    const offset = page * pageSize;

    const res = (await clerk.users.getUserList({
      limit,
      offset,
      orderBy: "-created_at",
    })) as unknown as { data: ClerkUser[]; totalCount?: number };

    const users = (res.data ?? []).map((u) => {
      const email =
        u.primaryEmailAddress?.emailAddress ||
        u.emailAddresses?.[0]?.emailAddress ||
        null;
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—";
      const sub = subByUser.get(String(u.id)) ?? null;
      return {
        id: u.id,
        email,
        name,
        username: u.username,
        joinedAt: u.createdAt ?? null,
        lastActiveAt: u.lastSignInAt ?? null,
        tier: normalizeTier(sub?.tier),
        subscriptionStatus: String(sub?.status ?? "active"),
        subscriptionCreatedAt: sub?.created_at ?? null,
        expiresAt: sub?.expires_at ?? null,
      };
    });

    const filtered = users.filter((u) => {
      if (q) {
        const hay = `${u.email ?? ""} ${u.name ?? ""} ${u.username ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tier && tier !== "all") {
        if (u.tier !== tier) return false;
      }
      if (status && status !== "all") {
        if (String(u.subscriptionStatus ?? "").toLowerCase() !== status) return false;
      }
      return true;
    });

    return NextResponse.json({
      rows: filtered,
      page,
      pageSize,
      total: res.totalCount ?? filtered.length,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

