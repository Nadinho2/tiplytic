import "server-only";

import React from "react";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { createServiceClient, insertAuditLog, requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/send-email";
import BroadcastEmail from "@/emails/BroadcastEmail";

type RecipientTier =
  | "everyone"
  | "free"
  | "basic_plus"
  | "pro_plus"
  | "elite"
  | "individual";

type SendBody = {
  subject?: string;
  body?: string;
  recipient_tier?: RecipientTier;
  individual_email?: string;
};

type ClerkUser = {
  id: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }> | null;
};

function normalizeTier(v: unknown) {
  const s = String(v ?? "").toLowerCase();
  if (s === "elite") return "elite";
  if (s === "pro") return "pro";
  if (s === "basic") return "basic";
  return "free";
}

function tierAtLeast(tier: string, min: "basic" | "pro") {
  const t = normalizeTier(tier);
  if (min === "basic") return t === "basic" || t === "pro" || t === "elite";
  return t === "pro" || t === "elite";
}

async function tryInsertBroadcast(
  supabase: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
) {
  try {
    await supabase.from("email_broadcasts").insert(row as never);
  } catch {}
}

export async function GET() {
  const supabase = createServiceClient();
  try {
    await requireAdmin();
    const { data } = await supabase
      .from("email_broadcasts")
      .select("id,subject,recipient_tier,recipient_count,sent_by,sent_at")
      .order("sent_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as SendBody;

    const subject = String(body.subject ?? "").trim();
    const content = String(body.body ?? "").trim();
    const recipientTier = (String(body.recipient_tier ?? "everyone") as RecipientTier) || "everyone";
    const individualEmail = String(body.individual_email ?? "").trim();

    if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "Body is required" }, { status: 400 });

    const recipients: Array<{ user_id: string; email: string }> = [];

    if (recipientTier === "individual") {
      if (!individualEmail) return NextResponse.json({ error: "Individual email is required" }, { status: 400 });
      recipients.push({ user_id: "manual", email: individualEmail });
    } else {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("clerk_user_id,tier,status")
        .limit(50_000);
      const subs =
        (data as Array<{ clerk_user_id: string; tier: string | null; status: string | null }> | null) ?? [];

      const candidates = subs.filter((s) => {
        const tier = normalizeTier(s.tier);
        if (recipientTier === "everyone") return true;
        if (recipientTier === "free") return tier === "free";
        if (recipientTier === "basic_plus") return tierAtLeast(tier, "basic");
        if (recipientTier === "pro_plus") return tierAtLeast(tier, "pro");
        if (recipientTier === "elite") return tier === "elite";
        return true;
      });

      const ids = Array.from(new Set(candidates.map((c) => String(c.clerk_user_id)).filter(Boolean)));
      const clerk = await clerkClient();
      const users: ClerkUser[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        try {
          const res = (await clerk.users.getUserList({
            userId: chunk,
            limit: Math.min(500, chunk.length || 1),
          })) as unknown as { data: ClerkUser[] };
          users.push(...(res.data ?? []));
        } catch {}
      }

      const emailById = new Map<string, string>();
      for (const u of users) {
        const email = u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || "";
        if (email) emailById.set(String(u.id), email);
      }

      for (const id of ids) {
        const email = emailById.get(id);
        if (email) recipients.push({ user_id: id, email });
      }
    }

    const limited = recipients.slice(0, 10_000);
    let sent = 0;
    let failed = 0;

    for (const r of limited) {
      const result = await sendEmail({
        to: r.email,
        subject,
        react: React.createElement(BroadcastEmail, { subject, body: content }),
      });
      if (result.success) sent += 1;
      else failed += 1;
    }

    await tryInsertBroadcast(supabase, {
      subject,
      body: content,
      recipient_tier: recipientTier,
      recipient_count: limited.length,
      sent_by: userId,
      sent_at: new Date().toISOString(),
    });

    await insertAuditLog(supabase, {
      admin_user_id: userId,
      action: "email.broadcast",
      target_type: "email_broadcast",
      details: { recipient_tier: recipientTier, recipient_count: limited.length, sent, failed },
    });

    return NextResponse.json({ ok: true, recipientCount: limited.length, sent, failed });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }
}

