"use client";

import Link from "next/link";
import { ContentWrap, PageHeader } from "@/components/ui";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Go online",
    body: "Toggle yourself online from the top of the screen. Delivery offers only come to you while you're online, and you carry one job at a time.",
  },
  {
    title: "Accept & pick up",
    body: "When a store confirms an order, an offer pops up with a ring — pickup store, area and your fee are on the card. Accept fast (first rider wins), head to the store shown, and tap 'Picked up from store' once the staff hand you the order.",
  },
  {
    title: "Arrive & confirm handover",
    body: "Navigate with the Maps link. At the door tap 'I've arrived', then ask the customer for the 4-digit code on their tracking page and confirm the handover.",
  },
  {
    title: "Wait during the try-on",
    body: "The customer tries everything on (about 7 minutes). A live timer runs on the delivery screen and your screen stays awake — please wait at the door.",
  },
  {
    title: "Collect returns",
    body: "The screen lists exactly which items they're returning — tick each one off as it's handed back.",
  },
  {
    title: "Complete & get paid",
    body: "Tap 'Collect returns & complete'. The delivery fee is added to your earnings instantly. Stuck at any point? Tap 'Problem?' on the delivery screen.",
  },
];

export function GuideView() {
  return (
    <ContentWrap>
      <PageHeader
        title="Rider guide"
        subtitle="The Fitxo try-at-home flow, start to finish."
      />

      {/* Plain div, not <Card>: Card's bg-white ties with bg-ink (equal
          Tailwind specificity) and can leave the white text invisible. */}
      <div className="mb-6 rounded-2xl bg-ink p-4">
        <p className="text-[15px] font-semibold text-accent">Welcome to Fitxo</p>
        <p className="mt-1 text-[14px] leading-6 text-white/75">
          Fitxo is try-before-you-buy fashion. You bring the customer their picks and wait
          while they decide — they keep what they love and hand the rest back to you. Here's
          how every delivery goes.
        </p>
      </div>

      <ol className="relative space-y-4 border-l border-line-strong pl-6">
        {STEPS.map((s, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[35px] grid h-7 w-7 place-items-center rounded-full bg-ink text-[12px] font-semibold text-accent">
              {i + 1}
            </span>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[15px] font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-[14px] leading-6 text-body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/deliveries"
        className="mt-6 flex h-14 items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-white transition hover:bg-ink-soft"
      >
        Go to my deliveries →
      </Link>
    </ContentWrap>
  );
}
