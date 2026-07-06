"use client";

import Link from "next/link";
import { ContentWrap, PageHeader, Card } from "@/components/ui";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Go online",
    body: "Toggle yourself online from the top of the screen. Delivery offers only come to you while you're online.",
  },
  {
    title: "Accept & pick up",
    body: "When a store confirms an order, an offer pops up with a ring. Accept it fast — the first rider to accept gets the job — then head to the store and tap 'Picked up from store'.",
  },
  {
    title: "Deliver to the door",
    body: "Navigate to the customer using the Maps link. When you hand over the bag, tap 'Mark delivered'.",
  },
  {
    title: "Wait during the try-on",
    body: "The customer tries everything on (about 7 minutes). A live timer shows on the delivery screen — please wait at the door.",
  },
  {
    title: "Collect returns",
    body: "The screen shows exactly which items they're returning. Collect those items before you leave.",
  },
  {
    title: "Complete & get paid",
    body: "Tap 'Collect returns & complete'. The delivery fee is added to your earnings instantly.",
  },
];

export function GuideView() {
  return (
    <ContentWrap>
      <PageHeader
        title="Rider guide"
        subtitle="The Fitzo try-at-home flow, start to finish."
      />

      <Card className="mb-6 border-ink bg-ink">
        <p className="text-[15px] font-semibold text-accent">Welcome to Fitzo</p>
        <p className="mt-1 text-[14px] leading-6 text-white/75">
          Fitzo is try-before-you-buy fashion. You bring the customer their picks and wait
          while they decide — they keep what they love and hand the rest back to you. Here's
          how every delivery goes.
        </p>
      </Card>

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
