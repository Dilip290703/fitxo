"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DeliveryFlowModal } from "@/components/DeliveryFlowModal";

/** The three beats of the Fitzo promise, shown as a stepper under the copy. */
const FLOW_STEPS = [
  { label: "Book a slot", detail: "Pick your window" },
  { label: "Try at your door", detail: "Rider waits" },
  { label: "Keep what fits", detail: "Pay for that only" },
];

function ArrowGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M5 12h13m-5-6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path d="M8 5.5v13l10-6.5-10-6.5z" fill="currentColor" />
    </svg>
  );
}

export function Hero() {
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#141b27]">
        {/* Ambient wash — two slow-drifting gold/blue blooms behind the copy.
            Purely decorative; motion is disabled under prefers-reduced-motion. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-bloom hero-bloom--gold absolute -left-32 top-[-10%] h-[520px] w-[520px] rounded-full opacity-[0.16] blur-[120px]" />
          <div className="hero-bloom hero-bloom--blue absolute bottom-[-20%] left-[28%] h-[460px] w-[460px] rounded-full opacity-[0.14] blur-[120px]" />
        </div>

        <div className="grid min-h-[88vh] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_44%]">
          {/* ---------- Copy column ---------- */}
          <div className="relative flex items-center px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
            <div className="hero-stagger w-full max-w-[560px]">
              <span
                className="hero-item inline-flex items-center gap-2 rounded-full border border-[#ffd233]/30 bg-[#ffd233]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffd233]"
                style={{ "--i": 0 } as React.CSSProperties}
              >
                <span className="hero-pulse h-1.5 w-1.5 rounded-full bg-[#ffd233]" />
                Now delivering in Pune
              </span>

              <h1
                className="hero-item mt-7 font-serif text-[clamp(2.75rem,6vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.02em] text-white"
                style={{ "--i": 1 } as React.CSSProperties}
              >
                <span className="block">Try before</span>
                <span className="block">
                  you{" "}
                  <span className="hero-underline relative inline-block text-[#ffd233]">
                    buy.
                  </span>
                </span>
              </h1>

              <p
                className="hero-item mt-6 max-w-[430px] text-[15px] leading-[1.75] text-[#b6bfcd]"
                style={{ "--i": 2 } as React.CSSProperties}
              >
                Browse collections from stores near you. A rider brings your picks
                to the door and{" "}
                <span className="font-medium text-white">waits while you try them on</span>
                {" "}— keep what you love, hand the rest straight back.
              </p>

              {/* Flow stepper */}
              <ol
                className="hero-item mt-9 flex flex-wrap items-center gap-x-3 gap-y-4"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                {FLOW_STEPS.map((step, index) => (
                  <li key={step.label} className="flex items-center gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-[11px] font-semibold text-[#ffd233]">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium leading-tight text-white">
                          {step.label}
                        </span>
                        <span className="block text-[11px] leading-tight text-[#7f8b9c]">
                          {step.detail}
                        </span>
                      </span>
                    </div>
                    {index < FLOW_STEPS.length - 1 ? (
                      <span aria-hidden="true" className="hidden text-[#3a4557] sm:block">
                        <ArrowGlyph />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>

              {/* CTAs */}
              <div
                className="hero-item mt-11 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                style={{ "--i": 4 } as React.CSSProperties}
              >
                <Link
                  href="/products"
                  className="group inline-flex h-[52px] items-center justify-center gap-3 rounded-full bg-[#ffd233] px-8 text-[13px] font-bold uppercase tracking-[0.14em] text-[#141b27] shadow-[0_16px_36px_-12px_rgba(255,210,51,0.7)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-12px_rgba(255,210,51,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd233] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141b27] active:translate-y-0"
                >
                  Pick your outfits
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    <ArrowGlyph />
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsFlowOpen(true)}
                  className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full border border-white/20 px-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d4dae3] transition duration-300 hover:border-white/45 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white transition group-hover:bg-[#ffd233] group-hover:text-[#141b27]">
                    <PlayGlyph />
                  </span>
                  Watch delivery flow
                </button>
              </div>
            </div>
          </div>

          {/* ---------- Image column ---------- */}
          <div className="relative isolate min-h-[380px] overflow-hidden lg:min-h-full">
            <Image
              src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80"
              alt=""
              fill
              className="hero-kenburns object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 44vw"
              priority
            />
            {/* Feathered seam so the photo melts into the copy column instead of
                butting against it with a hard edge. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#141b27] via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#141b27] lg:via-[#141b27]/25 lg:to-transparent"
            />

            {/* Floating proof chip */}
            <div className="hero-float absolute bottom-8 right-6 hidden rounded-2xl border border-white/15 bg-[#141b27]/70 px-5 py-4 backdrop-blur-md sm:block">
              <p className="text-[26px] font-semibold leading-none text-white">
                15–30<span className="ml-1 text-[13px] font-normal text-[#b6bfcd]">min</span>
              </p>
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-[#8b97a8]">
                Your rider waits
              </p>
            </div>
          </div>
        </div>
      </section>

      <DeliveryFlowModal isOpen={isFlowOpen} onClose={() => setIsFlowOpen(false)} />
    </>
  );
}
