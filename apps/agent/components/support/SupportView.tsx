"use client";

import { useState } from "react";
import { ContentWrap, PageHeader, Card, Label } from "@/components/ui";

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
          className="flex items-center gap-3 rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4 transition hover:border-[#3b82f6]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#16322a] text-[18px]">📞</span>
          <div>
            <p className="text-[14px] font-semibold">Call rider helpline</p>
            <p className="text-[12px] text-[#7c8aa5]">+91 80000 00000 · 24×7</p>
          </div>
        </a>
        <a
          href="mailto:riders@fitzo.in"
          className="flex items-center gap-3 rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4 transition hover:border-[#3b82f6]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#1e2a45] text-[18px]">✉️</span>
          <div>
            <p className="text-[14px] font-semibold">Email support</p>
            <p className="text-[12px] text-[#7c8aa5]">riders@fitzo.in</p>
          </div>
        </a>
      </div>

      <Card>
        <Label>Frequently asked</Label>
        <div className="mt-1 divide-y divide-[#22304a]">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                >
                  <span className="text-[13px] font-medium">{item.q}</span>
                  <span className={["text-[#7c8aa5] transition", isOpen ? "rotate-180" : ""].join(" ")}>⌄</span>
                </button>
                {isOpen && <p className="pb-3.5 text-[13px] leading-6 text-[#9fb0cc]">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </ContentWrap>
  );
}
