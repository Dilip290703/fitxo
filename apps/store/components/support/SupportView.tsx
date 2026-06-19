"use client";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does the try window work?",
    a: "When the rider delivers, they wait 15–30 minutes while the customer tries the items on. The customer keeps (and pays for) what they like and hands the rest back to the rider on the spot. You see each item's keep/return outcome on the order detail.",
  },
  {
    q: "When do I get paid?",
    a: "Fitzo issues a payout for every item the customer keeps. Track pending and paid amounts on the Earnings page — payouts are settled to your registered account.",
  },
  {
    q: "What does \"Mark ready\" do?",
    a: "It tells the Fitzo rider an item is packed and ready for pickup at your store. Mark items ready as soon as an order comes in to speed up delivery.",
  },
  {
    q: "What happens to returned items?",
    a: "The customer hands returns back to the rider at the door, and the rider brings them back to your store on the same trip. The Returns page shows each return's condition (good/damaged) and status.",
  },
  {
    q: "How do I change my store name or add a staff member?",
    a: "Store identity and staff accounts are managed by the Fitzo team — email us from your registered store address and we'll handle it.",
  },
];

export function SupportView({ storeName }: { storeName: string }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Support</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          We're here to help
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
        For urgent order issues (a rider hasn't arrived, a wrong item was picked up),
        email with the order number in the subject line and we'll prioritise it.
      </p>
    </div>
  );
}
