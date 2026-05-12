"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";

const RECIPIENTS = [
  { value: "everyone", label: "Everyone" },
  { value: "free", label: "Free only" },
  { value: "basic_plus", label: "Basic+" },
  { value: "pro_plus", label: "Pro+" },
  { value: "elite", label: "Elite only" },
  { value: "individual", label: "Individual email" },
] as const;

const TEMPLATES = [
  "welcome",
  "payment-failed",
  "subscription-expired",
  "badge-earned",
  "challenge-won",
  "bankroll-warning",
  "accumulator-result",
  "pick-locked",
  "account-milestone",
  "weekly-summary",
  "weekly-report",
] as const;

type BroadcastRow = {
  id: string;
  subject: string;
  recipient_tier: string | null;
  recipient_count: number | null;
  sent_by: string | null;
  sent_at: string | null;
};

export function EmailsClient({ initialTab }: { initialTab: string }) {
  const [tab, setTab] = useState(initialTab === "history" ? "history" : "compose");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<(typeof RECIPIENTS)[number]["value"]>("everyone");
  const [individualEmail, setIndividualEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<BroadcastRow[]>([]);

  const [previewTemplate, setPreviewTemplate] = useState<(typeof TEMPLATES)[number]>("welcome");
  const [previewEmail, setPreviewEmail] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const canSend = useMemo(() => subject.trim().length > 0 && body.trim().length > 0, [body, subject]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (tab !== "history") return;
      setLoadingHistory(true);
      const res = await fetch("/api/admin/email-broadcasts", { method: "GET" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { rows?: BroadcastRow[]; error?: string } | null;
      if (cancelled) return;
      if (!res || !res.ok || !json?.rows) {
        toast.error(json?.error || "Failed to load history");
        setHistory([]);
        setLoadingHistory(false);
        return;
      }
      setHistory(json.rows);
      setLoadingHistory(false);
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function send() {
    if (!canSend) {
      toast.error("Subject and body are required");
      return;
    }
    if (recipient === "individual" && !individualEmail.trim()) {
      toast.error("Enter an email address");
      return;
    }
    const ok = window.confirm("Send broadcast now?");
    if (!ok) return;

    setSending(true);
    const res = await fetch("/api/admin/email-broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject,
        body,
        recipient_tier: recipient,
        individual_email: recipient === "individual" ? individualEmail.trim() : undefined,
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; recipientCount?: number; sent?: number; failed?: number; error?: string } | null;
    setSending(false);
    if (!res || !res.ok || !json?.ok) {
      toast.error(json?.error || "Send failed");
      return;
    }
    toast.success(`Sent ${json.sent ?? 0}/${json.recipientCount ?? 0}`);
    setSubject("");
    setBody("");
    setIndividualEmail("");
  }

  async function preview() {
    setPreviewing(true);
    const to = "test@example.com";
    const res = await fetch(`/api/emails/${encodeURIComponent(previewTemplate)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: to, previewOnly: true }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { previewHtml?: string; error?: string } | null;
    setPreviewing(false);
    if (!res || !res.ok || !json?.previewHtml) {
      toast.error(json?.error || "Preview failed");
      return;
    }
    setPreviewEmail(json.previewHtml);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Comms</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Email broadcasts</h1>
        <p className="mt-2 text-sm text-muted">Compose broadcasts and view send history.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("compose")}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "compose" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          Compose
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            tab === "history" ? "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6]" : "border-white/10 bg-white/5 text-white",
          )}
        >
          History
        </button>
      </div>

      {tab === "compose" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="bg-[#0D1320] lg:col-span-2">
            <CardHeader>
              <div className="text-sm font-semibold">Compose</div>
              <div className="mt-1 text-sm text-muted">Markdown-like plain text (line breaks preserved).</div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted">Subject</div>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Announcement…"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted">Body</div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Write message…"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted">Recipients</div>
                    <select
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value as (typeof RECIPIENTS)[number]["value"])}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                    >
                      {RECIPIENTS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Individual email</div>
                    <input
                      value={individualEmail}
                      onChange={(e) => setIndividualEmail(e.target.value)}
                      disabled={recipient !== "individual"}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                      placeholder="name@email.com"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending}
                  className="w-full rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send broadcast"}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0D1320]">
            <CardHeader>
              <div className="text-sm font-semibold">Template preview</div>
              <div className="mt-1 text-sm text-muted">Render any system email template.</div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <select
                  value={previewTemplate}
                  onChange={(e) => setPreviewTemplate(e.target.value as (typeof TEMPLATES)[number])}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void preview()}
                  disabled={previewing}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {previewing ? "Rendering…" : "Preview"}
                </button>

                {previewEmail ? (
                  <iframe
                    title="Email preview"
                    className="h-[520px] w-full rounded-xl border border-white/10 bg-black"
                    srcDoc={previewEmail}
                  />
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    Pick a template and preview it.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-[#0D1320]">
          <CardHeader>
            <div className="text-sm font-semibold">Sent broadcasts</div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
              <div className="grid grid-cols-12 bg-background/40 px-4 py-3 text-xs font-medium text-muted">
                <div className="col-span-5">Subject</div>
                <div className="col-span-2">Tier</div>
                <div className="col-span-2">Recipients</div>
                <div className="col-span-3 text-right">Sent</div>
              </div>
              {loadingHistory ? (
                <div className="px-4 py-8 text-sm text-muted">Loading…</div>
              ) : history.length ? (
                <div className="divide-y divide-border">
                  {history.map((h) => (
                    <div key={h.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                      <div className="col-span-5 truncate text-foreground">{h.subject}</div>
                      <div className="col-span-2 text-muted">{String(h.recipient_tier ?? "—")}</div>
                      <div className="col-span-2 text-muted">{(h.recipient_count ?? 0).toLocaleString()}</div>
                      <div className="col-span-3 text-right text-muted">{h.sent_at ? new Date(h.sent_at).toLocaleString() : "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-muted">No broadcasts sent yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
