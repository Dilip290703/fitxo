"use client";

import { useState } from "react";
import { Card, ContentWrap, Label, PageHeader } from "@/components/ui";
import { IconChevronDown, IconMail, IconPhone } from "@/components/icons";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does a Fitzo delivery work?",
    a: "You pick up the customer's picks from the store, deliver to their door, and wait while they try things on (about 7 minutes). They keep what they love and hand the rest back to you on the spot — no return trip needed.",
  },
  {
    q: "When do I get paid?",
    a: "You earn the delivery fee on every completed job. Earnings are tracked live on the Earnings screen and settled to your account through Razorpay (payouts coming soon).",
  },
  {
    q: "What if the customer isn't home?",
    a: "Call them using the number on the delivery screen. If you can't reach them, contact support and we'll help you mark the delivery accordingly.",
  },
  {
    q: "Why can't I go online?",
    a: "New rider accounts need admin verification first. Once you're verified you'll be able to toggle online and start receiving jobs.",
  },
  {
    q: "How do I collect returns?",
    a: "After the try-on window, the delivery screen shows exactly which items to collect. Take them back, tap 'Collect returns & complete', and you're done.",
  },
];

export function SupportView() {
  const [open, setOpen] = useState<number | null>(0);

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
          href="mailto:riders@fitzo.in"
          className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-line-strong hover:shadow-float"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-info-bg text-info">
            <IconMail size={19} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">Email support</p>
            <p className="text-[13px] text-soft">riders@fitzo.in</p>
          </div>
        </a>
      </div>

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
