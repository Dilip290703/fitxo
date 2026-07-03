"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const STEPS: { title: string; body: string; href?: string; cta?: string }[] = [
  {
    title: "Complete your store profile",
    body: "Add your contact details and address so riders and the Fitzo team can reach you.",
    href: "/settings",
    cta: "Open settings",
  },
  {
    title: "Build your catalogue",
    body: "Add products with colours, sizes, SKUs and stock. Only active products with stock appear to customers.",
    href: "/catalogue",
    cta: "Open catalogue",
  },
  {
    title: "Prepare orders fast",
    body: "When an order arrives, pack the items and hit \"Mark ready\" so a rider can pick them up. Speed here directly improves your keep rate.",
    href: "/orders",
    cta: "View orders",
  },
  {
    title: "Understand the try window",
    body: "At delivery, the rider waits 15–30 minutes while the customer tries the items on. They pay for what they keep; the rest is handed straight back to the rider and returns to you — no separate pickup.",
  },
  {
    title: "Handle returns",
    body: "Track incoming returns and their condition on the Returns page, and restock items when they arrive.",
    href: "/returns",
    cta: "View returns",
  },
  {
    title: "Watch your earnings grow",
    body: "Every kept item generates a payout. Follow pending and settled amounts on Earnings, and spot your best sellers in Analytics.",
    href: "/earnings",
    cta: "View earnings",
  },
];

export function OnboardingView() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Guide"
        title="Selling on Fitzo"
        sub="Fitzo brings the fitting room to your customers' doorstep: they order, try on while the rider waits, and keep only what they love. Here's how to run your store on it."
      />

      <ol className="mt-7 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 text-[13px] leading-6 text-body">{s.body}</p>
              {s.href ? (
                <Link
                  href={s.href}
                  className="mt-2 inline-block text-[12px] font-semibold text-soft underline-offset-4 hover:text-ink hover:underline"
                >
                  {s.cta} →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-2xl bg-cream px-5 py-4 text-[12px] leading-6 text-body">
        Questions at any step? The <Link href="/support" className="font-semibold underline underline-offset-4">Support page</Link> has
        FAQs and direct contact with the partner team.
      </p>
    </div>
  );
}
