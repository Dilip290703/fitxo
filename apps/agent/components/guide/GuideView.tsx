"use client";

import Link from "next/link";
import { ContentWrap, PageHeader, Card } from "@/components/ui";

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: "🟢",
    title: "Go online",
    body: "Toggle yourself online from the top of the screen. You'll only be assigned jobs while you're online.",
  },
  {
    icon: "📦",
    title: "Accept & pick up",
    body: "A new job appears on your Deliveries screen. Accept it, head to the store, and tap 'Picked up from store'.",
  },
  {
    icon: "🛵",
    title: "Deliver to the door",
    body: "Navigate to the customer using the Maps link. When you hand over the bag, tap 'Mark delivered'.",
  },
  {
    icon: "⏱️",
    title: "Wait during the try-on",
    body: "The customer tries everything on (about 7 minutes). A live timer shows on the delivery screen — please wait.",
  },
  {
    icon: "↩️",
    title: "Collect returns",
    body: "The screen shows exactly which items they're returning. Collect those items before you leave.",
  },
  {
    icon: "✅",
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

      <Card className="mb-6 border-[#3b82f6]/40 bg-[#10203f]">
        <p className="text-[14px] font-semibold text-white">🚀 Welcome to Fitzo</p>
        <p className="mt-1 text-[13px] leading-6 text-[#9fb0cc]">
          Fitzo is try-before-you-buy fashion. You bring the customer their picks and wait
          while they decide — they keep what they love and hand the rest back to you. Here's
          how every delivery goes.
        </p>
      </Card>

      <ol className="relative space-y-4 border-l border-[#22304a] pl-6">
        {STEPS.map((s, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[33px] grid h-6 w-6 place-items-center rounded-full bg-[#161e2e] text-[12px] ring-1 ring-[#22304a]">
              {i + 1}
            </span>
            <div className="rounded-[14px] border border-[#22304a] bg-[#161e2e] p-4">
              <p className="text-[14px] font-semibold">
                <span className="mr-1.5">{s.icon}</span>
                {s.title}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-[#9fb0cc]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/deliveries"
        className="mt-6 block rounded-[12px] bg-[#3b82f6] py-3 text-center text-[14px] font-semibold text-white transition hover:bg-[#2f6fdc]"
      >
        Go to my deliveries →
      </Link>
    </ContentWrap>
  );
}
