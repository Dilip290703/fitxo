"use client";

import { useCallback, useEffect, useState } from "react";
import { useAgent } from "@/components/AgentShell";
import { fetchMyTickets, fileSupportTicket, type SupportTicket } from "@/lib/agent-data";
import { Banner, Card, ContentWrap, Label, PageHeader, Skeleton, btnPrimary, inputCls } from "@/components/ui";
import { IconChevronDown, IconMail, IconPhone } from "@/components/icons";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does a Fitxo delivery work?",
    a: "You collect the customer's picks from the store shown on the job, deliver to their door, confirm the handover with their 4-digit code, and wait while they try things on (about 7 minutes). They keep what they love and hand the rest back to you on the spot — no return trip.",
  },
  {
    q: "When do I get paid?",
    a: "You earn the delivery fee on every completed job. Add your bank/UPI details in Settings — Fitxo settles your earnings there, and every settlement shows up under Earnings → Payout history.",
  },
  {
    q: "What if the customer isn't home?",
    a: "Call them from the delivery screen. If you still can't reach them, tap 'Problem?' on the delivery → 'Can't deliver' — pick a reason, return the items to the store, and support takes it from there.",
  },
  {
    q: "Why can't I go online?",
    a: "New rider accounts need admin verification first. Once you're verified you'll be able to toggle online and start receiving jobs.",
  },
  {
    q: "How do I collect returns?",
    a: "After the try-on window, the delivery screen lists exactly which items to collect — tick each one off as it's handed back, then tap 'Collect returns & complete'.",
  },
];

const TICKET_TOPICS = ["Payment / earnings", "App problem", "Account / verification", "A past delivery", "Other"];

export function SupportView() {
  const { rider } = useAgent();
  const [open, setOpen] = useState<number | null>(null);

  // Ticket form
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // My tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    const { rows } = await fetchMyTickets(rider.userId);
    setTickets(rows);
    setTicketsLoading(false);
  }, [rider.userId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic || message.trim().length < 10) {
      setFormMsg({ kind: "err", text: "Pick a topic and describe the issue (a sentence or two)." });
      return;
    }
    setSending(true);
    setFormMsg(null);
    const { error } = await fileSupportTicket({
      userId: rider.userId,
      riderName: rider.name,
      subject: topic,
      message: message.trim(),
    });
    setSending(false);
    if (error) {
      setFormMsg({ kind: "err", text: error.message });
      return;
    }
    setTopic(null);
    setMessage("");
    setFormMsg({ kind: "ok", text: "Ticket sent — Fitxo support will reply here." });
    loadTickets();
  }

  return (
    <ContentWrap>
      <PageHeader title="Support" subtitle="We've got your back on the road." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <a
          href="tel:+918000000000"
          className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-line-strong hover:shadow-float"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-bg text-success">
            <IconPhone size={19} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">Call rider helpline</p>
            <p className="text-[13px] text-soft">+91 80000 00000 · 24×7</p>
          </div>
        </a>
        <a
          href="mailto:riders@fitxo.co.in"
          className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-line-strong hover:shadow-float"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-info-bg text-info">
            <IconMail size={19} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">Email support</p>
            <p className="text-[13px] text-soft">riders@fitxo.co.in</p>
          </div>
        </a>
      </div>

      {/* Raise a ticket — lands in Admin > Complaints */}
      <Card className="mb-6">
        <Label>Raise a ticket</Label>
        <p className="text-[13px] text-body">
          For anything that isn't urgent enough to call about. Support replies show up below.
        </p>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {TICKET_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={[
                  "h-10 rounded-full border px-3.5 text-[13px] font-medium transition",
                  topic === t
                    ? "border-ink bg-ink text-white"
                    : "border-line-strong bg-white text-body hover:border-ink",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="What happened? Include the order number if it's about a delivery."
            className={inputCls.replace("h-12", "min-h-[88px] py-3")}
          />
          {formMsg && <Banner kind={formMsg.kind}>{formMsg.text}</Banner>}
          <button type="submit" disabled={sending} className={btnPrimary}>
            {sending ? "Sending…" : "Send ticket"}
          </button>
        </form>
      </Card>

      {/* My tickets */}
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
        My tickets
      </h2>
      {ticketsLoading ? (
        <Skeleton className="mb-6 h-[76px]" />
      ) : tickets.length === 0 ? (
        <Card className="mb-6">
          <p className="text-[14px] text-body">No tickets yet — anything you send lands here with Fitxo's reply.</p>
        </Card>
      ) : (
        <div className="mb-6 space-y-2">
          {tickets.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-[14px] font-semibold text-ink">
                  {t.subject.replace(/^\[Rider:[^\]]*\]\s*/, "")}
                </p>
                <TicketStatus status={t.status} />
              </div>
              <p className="mt-1 text-[13px] leading-5 text-body">{t.message}</p>
              <p className="mt-1 text-[11px] text-faint">
                {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {t.adminResponse && (
                <div className="mt-2 rounded-xl bg-cream p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Fitxo replied</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-ink">{t.adminResponse}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card>
        <Label>Frequently asked</Label>
        <div className="mt-1 divide-y divide-hairline">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="text-[14px] font-medium text-ink">{item.q}</span>
                  <IconChevronDown
                    size={16}
                    className={["shrink-0 text-muted transition", isOpen ? "rotate-180" : ""].join(" ")}
                  />
                </button>
                {isOpen && <p className="pb-3.5 text-[14px] leading-6 text-body">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </ContentWrap>
  );
}

function TicketStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "border-warn-bg bg-warn-bg text-warn",
    in_progress: "border-info-bg bg-info-bg text-info",
    resolved: "border-success-line bg-success-bg text-success",
    closed: "border-line bg-cream text-soft",
  };
  return (
    <span
      className={[
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        styles[status] ?? "border-line bg-cream text-soft",
      ].join(" ")}
    >
      {status.replace("_", " ")}
    </span>
  );
}
