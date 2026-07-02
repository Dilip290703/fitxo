"use client";

import { FormEvent, useEffect, useState } from "react";
import { fileTicket, loadMyTickets, type Ticket, type TicketStatus } from "@/lib/support";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does the try window work?",
    a: "When the rider delivers, they wait 15–30 minutes while the customer tries the items on. The customer keeps (and pays for) what they like and hands the rest back to the rider on the spot. You see each item's keep/return outcome on the order detail.",
  },
  {
    q: "When do I get paid?",
    a: "Fitzo issues a payout for every item the customer keeps, net of commission. Track net earnings, pending and paid amounts on the Earnings page — payouts are settled to the account you registered during onboarding.",
  },
  {
    q: 'What does "Mark ready" do?',
    a: "It tells the Fitzo rider an item is packed and ready for pickup at your store. Mark items ready as soon as an order comes in to speed up delivery.",
  },
  {
    q: "What happens to returned items?",
    a: "The customer hands returns back to the rider at the door, and the rider brings them back to your store on the same trip. The Returns page shows each return's condition (good/damaged) and status.",
  },
  {
    q: "How do I change my store name or add a staff member?",
    a: "Store identity and staff accounts are managed by the Fitzo team — raise a ticket below or email us from your registered store address and we'll handle it.",
  },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: "bg-[#fbeed0] text-[#9a6a12]",
  in_progress: "bg-[#e3ecf6] text-[#2d5e8f]",
  resolved: "bg-[#e8f3ea] text-[#2f7d46]",
  closed: "bg-[#eeeae3] text-[#7f7469]",
};

const inputClass =
  "h-11 w-full rounded-xl border border-[#ded3c6] bg-white px-3.5 text-[14px] text-[#171d2b] outline-none transition focus:border-[#171d2b] focus:ring-4 focus:ring-[#ffd233]/25";

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function SupportView({ storeName }: { storeName: string }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState("");

  // form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    loadMyTickets()
      .then(setTickets)
      .catch(() => setLoadError("Couldn't load your tickets."));
  };

  useEffect(refresh, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setNotice("");
    if (!subject.trim() || !message.trim()) {
      setFormError("Add a subject and a short description.");
      return;
    }
    setSubmitting(true);
    try {
      await fileTicket(storeName, subject, message, orderNumber || undefined);
      setSubject("");
      setMessage("");
      setOrderNumber("");
      setNotice("Ticket filed — the Fitzo team will respond here and by email.");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't file the ticket. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Support</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          We&apos;re here to help
        </h1>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:partners@fitzo.in?subject=${encodeURIComponent(`[Store support] ${storeName}`)}`}
          className="rounded-2xl border border-[#ece5da] bg-white p-5 transition hover:border-[#171d2b]"
        >
          <p className="text-[20px]">✉️</p>
          <p className="mt-2 text-[14px] font-semibold text-[#171d2b]">Email partner support</p>
          <p className="mt-1 text-[13px] text-[#625b53]">partners@fitzo.in — replies within 1 business day.</p>
        </a>
        <div className="rounded-2xl border border-[#ece5da] bg-white p-5">
          <p className="text-[20px]">📞</p>
          <p className="mt-2 text-[14px] font-semibold text-[#171d2b]">Partner helpline</p>
          <p className="mt-1 text-[13px] text-[#625b53]">
            Mon–Sat, 10am–7pm. The number is shared in your onboarding email.
          </p>
        </div>
      </section>

      {/* Raise a ticket */}
      <section className="mt-6 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-[#171d2b]">Raise a ticket</h2>
        <p className="mt-1 text-[12px] text-[#7c7268]">
          Filed straight to the Fitzo team — responses appear under &quot;Your tickets&quot; below.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7f7469]">
                Subject
              </span>
              <input
                className={inputClass}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setFormError("");
                }}
                placeholder="e.g. Rider hasn't arrived for pickup"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7f7469]">
                Order no. (optional)
              </span>
              <input
                className={`${inputClass} font-mono`}
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  setFormError("");
                }}
                placeholder="FZ-…"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7f7469]">
              What&apos;s going on?
            </span>
            <textarea
              className={`${inputClass} h-auto min-h-[90px] py-2.5`}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setFormError("");
              }}
              placeholder="A few lines so we can help fast."
            />
          </label>

          {formError ? (
            <p role="alert" className="rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
              {formError}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-xl border border-[#bfe0c9] bg-[#eef7f0] px-4 py-3 text-[13px] font-medium text-[#2f7a4d]">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-full bg-[#171d2b] px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1f2a3c] disabled:opacity-60"
          >
            {submitting ? "Filing…" : "File ticket"}
          </button>
        </form>
      </section>

      {/* Your tickets */}
      <section className="mt-6 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-[#171d2b]">Your tickets</h2>
        {loadError ? (
          <p className="mt-3 text-[13px] text-[#b83c24]">{loadError}</p>
        ) : tickets === null ? (
          <p className="mt-3 text-[13px] text-[#958675]">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#7f7469]">No tickets yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#f0ebe3]">
            {tickets.map((t) => (
              <li key={t.id} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#171d2b]">
                    {t.subject.replace(/^\[Store: [^\]]*\]\s*/, "")}
                  </p>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#958675]">
                  {formatDate(t.createdAt)}
                  {t.orderNumber ? (
                    <>
                      {" · "}
                      <span className="font-mono">{t.orderNumber}</span>
                    </>
                  ) : null}
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-[#5f574e]">{t.message}</p>
                {t.adminResponse ? (
                  <div className="mt-2 rounded-xl bg-[#f6f1e8] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#958675]">
                      Fitzo team
                    </p>
                    <p className="mt-1 text-[13px] leading-6 text-[#4b453e]">{t.adminResponse}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-[#171d2b]">Frequently asked</h2>
        <div className="mt-2 divide-y divide-[#f0ebe3]">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-[#171d2b]">
                {f.q}
                <span className="shrink-0 text-[#958675] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[13px] leading-6 text-[#5f574e]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-5 rounded-2xl bg-[#f6f1e8] px-5 py-4 text-[12px] leading-6 text-[#6a6259]">
        For urgent order issues (a rider hasn&apos;t arrived, a wrong item was picked up),
        file a ticket with the order number and we&apos;ll prioritise it.
      </p>
    </div>
  );
}
