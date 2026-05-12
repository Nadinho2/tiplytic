import "server-only";

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";

type Tier = "free" | "basic" | "pro" | "elite";

function isTier(v: string): v is Tier {
  return v === "free" || v === "basic" || v === "pro" || v === "elite";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createServiceClient();
  try {
    const { userId: adminUserId } = await requireAdmin();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { tier?: string };
    const tierRaw = String(body.tier ?? "").toLowerCase();
    if (!isTier(tierRaw)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

    const patch: Record<string, unknown> = {
      clerk_user_id: id,
      tier: tierRaw,
      status: "active",
      updated_at: new Date().toISOString(),
    };

    if (tierRaw === "free") patch.expires_at = null;

    const { error } = await supabase.from("user_subscriptions").upsert(patch as never, {
      onConflict: "clerk_user_id",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(id);
      const current = (user.publicMetadata ?? {}) as Record<string, unknown>;
      await clerk.users.updateUserMetadata(id, {
        publicMetadata: {
          ...current,
          subscription: {
            tier: tierRaw,
            status: "active",
            expiresAt: tierRaw === "free" ? null : (patch.expires_at as string | null | undefined) ?? null,
            trialEndsAt: null,
          },
        },
      });
    } catch {}

    await insertAuditLog(supabase, {
      admin_user_id: adminUserId,
      action: "user.set_tier",
      target_type: "user",
      target_id: id,
      details: { tier: tierRaw },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}
