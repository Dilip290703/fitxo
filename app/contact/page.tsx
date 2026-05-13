

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
type IconProps = {
  className?: string;
};

function IconCircle({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function ArrowRight({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckCircle2({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function Clock({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Mail({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  );
}

function MapPin({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function MessageCircle({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L4 20l.9-4.4A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function Phone({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function RotateCcw({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M3.8 13A8 8 0 1 0 6 5.3L3 8" />
    </svg>
  );
}

function ShieldCheck({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m8.5 12 2 2 5-5" />
    </svg>
  );
}

function Sparkles({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

function Truck({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

const contactCards = [
  {
    icon: MessageCircle,
    title: "Chat with support",
    value: "Fastest response",
    text: "Get help with orders, try-ons, returns, payments, and delivery updates.",
    action: "Start chat",
  },
  {
    icon: Phone,
    title: "Call Fitzo Care",
    value: "+91 98765 43210",
    text: "Available daily for urgent order or doorstep try-on support.",
    action: "Call now",
  },
  {
    icon: Mail,
    title: "Email us",
    value: "support@fitzo.in",
    text: "Best for brand partnerships, store onboarding, and detailed requests.",
    action: "Send email",
  },
];

const supportTopics = [
  { icon: Truck, title: "Delivery help", text: "Track live orders, change pincode, or update delivery timing." },
  { icon: RotateCcw, title: "Returns & pickup", text: "Schedule pickup for items you do not want to keep." },
  { icon: ShieldCheck, title: "Payment safety", text: "Resolve failed payments, refunds, wallet, or pay-later issues." },
  { icon: Sparkles, title: "Style support", text: "Ask about sizing, outfit matching, and try-at-home suggestions." },
];

const faqs = [
  "How does try-before-you-buy work?",
  "Can I return items at the doorstep?",
  "How fast can Fitzo deliver near me?",
  "How do I contact partner stores?",
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#111827]">
      <section className="relative overflow-hidden border-b border-[#e9e1d5] bg-[#f6f1e9] px-5 py-20 sm:px-8 lg:px-12">
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-[#ffd36a]/30 blur-3xl" />
        <div className="absolute bottom-[-150px] right-[-120px] h-80 w-80 rounded-full bg-[#ffc2a6]/45 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.04fr_0.96fr]">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.42em] text-[#8b6f55]">Contact Fitzo</p>
            <h1 className="max-w-3xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] text-[#111111] sm:text-6xl lg:text-7xl">
              We are here before, during, and after your try-on.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[#5f6470] sm:text-lg">
              Need help with delivery, sizing, returns, payment, or partner stores? Reach our care team and get clear support without waiting in a fitting-room queue.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#contact-form"
                className="group inline-flex items-center justify-center rounded-full bg-[#111827] px-7 py-4 text-xs font-black uppercase tracking-[0.22em] text-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                Send a message
                <ArrowRight className="ml-3 h-4 w-4 transition duration-300 group-hover:translate-x-1" />
              </a>
              <a
                href="tel:+919876543210"
                className="inline-flex items-center justify-center rounded-full border border-[#d7cabc] bg-white/55 px-7 py-4 text-xs font-black uppercase tracking-[0.22em] text-[#111827] transition duration-300 hover:-translate-y-1 hover:bg-white"
              >
                Call support
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[2.2rem] border border-white bg-white p-3 shadow-[0_30px_90px_rgba(42,32,22,0.12)] transition duration-500 hover:-translate-y-2">
              <div className="relative min-h-[460px] overflow-hidden rounded-[1.7rem] bg-[linear-gradient(135deg,#142033_0%,#263954_55%,#f8c9a9_55%,#ffd9c1_100%)] p-8">
                <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(135deg,#ffffff_12.5%,transparent_12.5%,transparent_50%,#ffffff_50%,#ffffff_62.5%,transparent_62.5%,transparent_100%)] [background-size:32px_32px]" />
                <div className="relative z-10 max-w-sm rounded-[1.6rem] bg-white/90 p-7 shadow-2xl backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-[#9b7655]">Fitzo care promise</p>
                  <h2 className="mt-4 font-serif text-4xl leading-none text-[#111111]">Support that moves as fast as your outfit.</h2>
                  <div className="mt-7 space-y-4">
                    {["Average reply under 10 minutes", "Doorstep return guidance", "Secure payment assistance"].map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm font-semibold text-[#303642]">
                        <CheckCircle2 className="h-5 w-5 text-[#111827]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-8 right-8 z-10 rounded-3xl bg-[#ffd037] px-6 py-5 shadow-xl">
                  <p className="text-3xl font-black tracking-[-0.04em]">60 min</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.28em]">delivery window</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {contactCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="group rounded-[1.8rem] border border-[#eadfD1] bg-white p-7 shadow-[0_18px_50px_rgba(42,32,22,0.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_26px_70px_rgba(42,32,22,0.12)]"
              >
                <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#f8eadc] transition duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-3xl leading-none">{card.title}</h3>
                <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-[#8b6f55]">{card.value}</p>
                <p className="mt-4 text-sm leading-7 text-[#69707d]">{card.text}</p>
                <button className="mt-7 inline-flex items-center text-xs font-black uppercase tracking-[0.22em] transition duration-300 group-hover:translate-x-1">
                  {card.action} <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section id="contact-form" className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[2rem] bg-[#111827] p-8 text-white shadow-[0_30px_80px_rgba(17,24,39,0.18)] lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#ffd037]">Support topics</p>
            <h2 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">Choose what you need help with.</h2>
            <p className="mt-5 text-sm leading-7 text-white/70">
              We route your message to the right Fitzo team so you get useful answers faster.
            </p>

            <div className="mt-9 grid gap-4">
              {supportTopics.map((topic) => {
                const Icon = topic.icon;
                return (
                  <div key={topic.title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 transition duration-300 hover:bg-white/[0.1]">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-serif text-2xl leading-none">{topic.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/65">{topic.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#eadfD1] bg-white p-6 shadow-[0_25px_80px_rgba(42,32,22,0.08)] sm:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#8b6f55]">Message us</p>
                <h2 className="mt-3 font-serif text-4xl leading-none sm:text-5xl">Tell us what happened.</h2>
              </div>
              <div className="hidden rounded-full bg-[#fff3d1] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] sm:block">
                10 min avg reply
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#303642]">Full name</span>
                <input required className="mt-3 w-full rounded-2xl border border-[#e0d6ca] bg-[#fbfaf7] px-5 py-4 text-sm outline-none transition focus:border-[#111827] focus:bg-white" placeholder="Your name" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#303642]">Email</span>
                <input required type="email" className="mt-3 w-full rounded-2xl border border-[#e0d6ca] bg-[#fbfaf7] px-5 py-4 text-sm outline-none transition focus:border-[#111827] focus:bg-white" placeholder="you@example.com" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#303642]">Phone</span>
                <input className="mt-3 w-full rounded-2xl border border-[#e0d6ca] bg-[#fbfaf7] px-5 py-4 text-sm outline-none transition focus:border-[#111827] focus:bg-white" placeholder="+91 00000 00000" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#303642]">Topic</span>
                <select className="mt-3 w-full rounded-2xl border border-[#e0d6ca] bg-[#fbfaf7] px-5 py-4 text-sm outline-none transition focus:border-[#111827] focus:bg-white">
                  <option>Delivery support</option>
                  <option>Return or pickup</option>
                  <option>Payment or refund</option>
                  <option>Store partnership</option>
                  <option>Style help</option>
                </select>
              </label>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#303642]">Message</span>
              <textarea required rows={6} className="mt-3 w-full resize-none rounded-2xl border border-[#e0d6ca] bg-[#fbfaf7] px-5 py-4 text-sm outline-none transition focus:border-[#111827] focus:bg-white" placeholder="Tell us your order issue, pincode, item details, or question..." />
            </label>

            <button type="submit" className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-[#ffd037] px-7 py-4 text-xs font-black uppercase tracking-[0.22em] text-[#111827] transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-auto">
              Submit request <ArrowRight className="ml-3 h-4 w-4" />
            </button>

            {submitted && (
              <div className="mt-5 rounded-2xl border border-[#d9edc7] bg-[#f2ffe9] px-5 py-4 text-sm font-semibold text-[#2e5d21]">
                Thanks. Your request is ready for Fitzo support. Backend connection can be added later.
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="border-y border-[#e9e1d5] bg-[#fbfaf7] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#8b6f55]">Quick answers</p>
            <h2 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">Popular questions before you message.</h2>
          </div>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <Link key={faq} href="#contact-form" className="group flex items-center justify-between rounded-2xl border border-[#eadfD1] bg-white px-6 py-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className="font-semibold text-[#303642]">{faq}</span>
                <ArrowRight className="h-4 w-4 transition duration-300 group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          <div className="rounded-[1.6rem] border border-[#eadfD1] bg-white p-7">
            <MapPin className="h-6 w-6" />
            <h3 className="mt-5 font-serif text-3xl">Pune support hub</h3>
            <p className="mt-3 text-sm leading-7 text-[#69707d]">Fitzo Care, Baner Road, Pune, Maharashtra 411045</p>
          </div>
          <div className="rounded-[1.6rem] border border-[#eadfD1] bg-white p-7">
            <Clock className="h-6 w-6" />
            <h3 className="mt-5 font-serif text-3xl">Working hours</h3>
            <p className="mt-3 text-sm leading-7 text-[#69707d]">Every day, 9:00 AM – 10:00 PM. Urgent order support remains prioritized.</p>
          </div>
          <div className="rounded-[1.6rem] border border-[#eadfD1] bg-white p-7">
            <ShieldCheck className="h-6 w-6" />
            <h3 className="mt-5 font-serif text-3xl">Safe support</h3>
            <p className="mt-3 text-sm leading-7 text-[#69707d]">Never share OTPs, full card details, or passwords with anyone claiming to be Fitzo.</p>
          </div>
        </div>
      </section>
    </main>
  );
}