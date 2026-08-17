"use client";

import { FormEvent, useEffect, useState } from "react";
import { fileTicket, loadMyTickets, type Ticket, type TicketStatus } from "@/lib/support";
import { formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";
import { Field, inputClass } from "@/components/ui/FormField";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does the try window work?",
    a: "When the rider delivers, they wait 15–30 minutes while the customer tries the items on. The customer keeps (and pays for) what they like and hands the rest back to the rider on the spot. You see each item's keep/return outcome on the order detail.",
  },
  {
    q: "When do I get paid?",
    a: "Fitxo issues a payout for every item the customer keeps, net of commission. Track net earnings, pending and paid amounts on the Earnings page — payouts are settled to the account you registered during onboarding.",
  },
  {
    q: 'What does "Mark ready" do?',
    a: "It tells the Fitxo rider an item is packed and ready for pickup at your store. Mark items ready as soon as an order comes in to speed up delivery.",
  },
  {
    q: "What happens to returned items?",
    a: "The customer hands returns back to the rider at the door, and the rider brings them back to your store on the same trip. The Returns page shows each return's condition (good/damaged) and status.",
  },
  {
    q: "How do I change my store name or add a staff member?",
    a: "Store identity and staff accounts are managed by the Fitxo team — raise a ticket below or email us from your registered store address and we'll handle it.",
  },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  open: "amber",
  in_progress: "blue",
  resolved: "green",
  closed: "neutral",
};

export function SupportView() {
  const { storeName } = useStorePanel();
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
      setNotice("Ticket filed — the Fitxo team will respond here and by email.");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't file the ticket. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader eyebrow="Support" title="We're here to help" />

      <section className="mt-7 grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:partners@fitxo.co.in?subject=${encodeURIComponent(`[Store support] ${storeName}`)}`}
          className="rounded-2xl border border-line bg-white p-5 transition hover:border-ink"
        >
          <p className="text-[20px]">✉️</p>
          <p className="mt-2 text-[14px] font-semibold text-ink">Email partner support</p>
          <p className="mt-1 text-[13px] text-body">partners@fitxo.co.in — replies within 1 business day.</p>
        </a>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-[20px]">📞</p>
          <p className="mt-2 text-[14px] font-semibold text-ink">Partner helpline</p>
          <p className="mt-1 text-[13px] text-body">
            Mon–Sat, 10am–7pm. The number is shared in your onboarding email.
          </p>
        </div>
      </section>

      {/* Raise a ticket */}
      <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-ink">Raise a ticket</h2>
        <p className="mt-1 text-[12px] text-soft">
          Filed straight to the Fitxo team — responses appear under &quot;Your tickets&quot; below.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="Subject">
              <input
                className={inputClass}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setFormError("");
                }}
                placeholder="e.g. Rider hasn't arrived for pickup"
              />
            </Field>
            <Field label="Order no. (optional)">
              <input
                className={`${inputClass} font-mono`}
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  setFormError("");
                }}
                placeholder="FZ-…"
              />
            </Field>
          </div>
          <Field label="What's going on?">
            <textarea
              className={`${inputClass} h-auto min-h-[90px] py-2.5`}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setFormError("");
              }}
              placeholder="A few lines so we can help fast."
            />
          </Field>

          {formError ? <Banner variant="error">{formError}</Banner> : null}
          {notice ? <Banner variant="success">{notice}</Banner> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-full bg-ink px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft disabled:opacity-60"
          >
            {submitting ? "Filing…" : "File ticket"}
          </button>
        </form>
      </section>

      {/* Your tickets */}
      <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-ink">Your tickets</h2>
        {loadError ? (
          <p className="mt-3 text-[13px] text-danger">{loadError}</p>
        ) : tickets === null ? (
          <div className="-mx-5 mt-1" aria-hidden>
            <RowsSkeleton rows={2} />
          </div>
        ) : tickets.length === 0 ? (
          <p className="mt-3 text-[13px] text-soft">No tickets yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {tickets.map((t) => (
              <li key={t.id} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                    {t.subject.replace(/^\[Store: [^\]]*\]\s*/, "")}
                  </p>
                  <StatusBadge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {formatDate(t.createdAt)}
                  {t.orderNumber ? (
                    <>
                      {" · "}
                      <span className="font-mono">{t.orderNumber}</span>
                    </>
                  ) : null}
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-body">{t.message}</p>
                {t.adminResponse ? (
                  <div className="mt-2 rounded-xl bg-cream px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Fitxo team
                    </p>
                    <p className="mt-1 text-[13px] leading-6 text-body">{t.adminResponse}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-ink">Frequently asked</h2>
        <div className="mt-2 divide-y divide-hairline">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-ink">
                {f.q}
                <span className="shrink-0 text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[13px] leading-6 text-body">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-5 rounded-2xl bg-cream px-5 py-4 text-[12px] leading-6 text-body">
        For urgent order issues (a rider hasn&apos;t arrived, a wrong item was picked up),
        file a ticket with the order number and we&apos;ll prioritise it.
      </p>
    </div>
  );
}
