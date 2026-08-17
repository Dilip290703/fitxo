"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { NewsletterModal } from "@/components/NewsletterModal";
import { socialLinks, supportLinks } from "@/lib/mockData";

const footerColumns = [
  {
    title: "Company Info",
    items: [
      { label: "About Fitxo", href: "/about" },
      { label: "Social Responsibility", href: "/about" },
      { label: "Affiliate", href: "/contact" },
      { label: "Fashion Blogger", href: "/contact" },
    ],
  },
  {
    title: "Help & Support",
    items: [
      { label: "Shipping Info", href: "/contact" },
      { label: "Returns", href: "/refund-policy" },
      { label: "How to Order", href: "/how-it-works" },
      { label: "How to Track", href: "/how-it-works" },
      { label: "Size Chart", href: "/size-guide" },
    ],
  },
  {
    title: "Customer Care",
    items: [
      { label: "Contact Us", href: "/contact" },
      { label: "Payment", href: "/terms" },
      { label: "Bonus Point", href: "/profile" },
      { label: "Notices", href: "/privacy-policy" },
    ],
  },
];

const legalLinksTop = [
  { label: "Privacy Center", href: "/privacy-policy" },
  { label: "Privacy & Cookie Policy", href: "/privacy-policy" },
  { label: "Manage Cookies", href: "/privacy-policy" },
];

const legalLinksBottom = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Copyright Notice", href: "/terms" },
  { label: "Imprint", href: "/contact" },
];

// COD was removed from checkout (agent rework Phase 3, owner-approved) —
// the keep-flow is Razorpay-only, so the footer must not advertise cash.
const paymentItems = ["UPI", "G Pay", "Phonepe", "Paytm", "Cards"];

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.4 21v-7.3H16l.4-2.9h-3V8.9c0-.8.2-1.4 1.4-1.4h1.5V5c-.3 0-1.3-.1-2.4-.1-2.3 0-3.9 1.4-3.9 4.1v1.8H7.3v2.9H10V21h3.4z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21 7.2c-.7.3-1.4.5-2.1.6.8-.4 1.3-1.1 1.6-2-.7.4-1.5.8-2.4.9a3.9 3.9 0 00-6.7 3.6A11 11 0 013.5 6.6a3.9 3.9 0 001.2 5.2c-.6 0-1.1-.2-1.6-.4 0 1.9 1.3 3.4 3 3.8-.5.1-1 .2-1.5.1.4 1.4 1.8 2.5 3.4 2.5A7.8 7.8 0 013 19.5a11 11 0 005.9 1.7c7 0 10.9-5.8 10.9-10.9v-.5c.8-.5 1.5-1.2 2.1-2z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14.2 4c.4 1.8 1.4 2.9 3.1 3.4v2.3c-1.1 0-2.2-.3-3.1-.9v5.4c0 2.8-1.8 4.6-4.4 4.6-2.5 0-4.3-1.8-4.3-4.2 0-2.7 2-4.4 4.9-4.3v2.2c-1.4-.1-2.4.6-2.4 1.8 0 1 .8 1.8 1.8 1.8 1.2 0 1.9-.7 1.9-2.1V4h2.5z" />
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3c2.6 0 4.4 1.8 4.4 4.2 0 .5 0 1-.1 1.6.2.2.5.4.8.5.4.2.9.3 1.3.5.2.1.2.4.1.6-.4.4-1.1.7-1.9.8-.2.5-.5 1-.8 1.5.4.2.7.3 1.1.4.3.1.4.4.2.7-.4.5-1.1.7-1.9.7-.6.7-1.4 1.2-2.4 1.5l-.3.9H11l-.3-.9c-1-.3-1.8-.8-2.4-1.5-.8 0-1.5-.2-1.9-.7-.2-.3-.1-.6.2-.7.4-.1.7-.2 1.1-.4-.3-.5-.6-1-.8-1.5-.8-.1-1.5-.4-1.9-.8-.1-.2-.1-.5.1-.6.4-.2.9-.3 1.3-.5.3-.1.6-.3.8-.5-.1-.6-.1-1.1-.1-1.6C7.6 4.8 9.4 3 12 3z" />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d="M3.6 2.3c-.2.2-.3.6-.3 1v17.4c0 .4.1.8.3 1l10-10.7-10-8.7z" fill="#00d4ff" />
      <path d="M17.4 8.9L13.6 6.7 3.9 1.9c-.1 0-.2-.1-.3-.1L13.6 12l3.8-3.1z" fill="#00f076" />
      <path d="M20.5 10.6L17.4 8.9 13.6 12l3.8 3.1 3.1-1.7c.9-.5.9-1.3 0-1.8z" fill="#ffc900" />
      <path d="M3.6 21.7c.1 0 .2 0 .3-.1l9.7-4.8 3.8-2.2-3.8-3.1L3.6 21.7z" fill="#ff3a44" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M16.7 12.4c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.3.8-3 .8-.7 0-1.6-.8-2.6-.8-1.4 0-2.7.8-3.4 2-1.4 2.4-.4 6.1 1 8.1.7 1.1 1.5 2.1 2.6 2.1 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-.9 2.6-1.9.8-1.2 1.1-2.2 1.1-2.3 0 0-2.8-1.1-2.8-3.4zM14.8 6.1c.6-.7.9-1.7.8-2.6-.8 0-1.8.5-2.4 1.2-.6.7-1 1.6-.9 2.5.9.1 1.9-.5 2.5-1.1z" />
    </svg>
  );
}

function StoreBadge({
  href,
  top,
  bottom,
  children,
}: {
  href: string;
  top: string;
  bottom: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2.5 transition duration-200 hover:border-white/40 hover:bg-white/[0.1]"
    >
      <span className="text-[#faf9f6]">{children}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-[0.1em] text-[#a99f92]">{top}</span>
        <span className="text-[14px] font-semibold text-[#faf9f6]">{bottom}</span>
      </span>
    </a>
  );
}

function SocialButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/25 text-[#e8e2d9] transition duration-200 hover:border-[#faf9f6] hover:text-[#faf9f6]"
    >
      {children}
    </a>
  );
}

function PaymentBadge({ label }: { label: string }) {
  return (
    <span className="flex h-[34px] items-center justify-center rounded-[2px] border border-white/20 bg-white/5 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[#e8e2d9]">
      {label}
    </span>
  );
}

export function Footer() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setToastMessage(`You’re subscribed with ${trimmedEmail}.`);
    setEmail("");
    setIsSubmitting(false);
  };

  return (
    <>
      <footer id="footer" className="bg-[#191309] text-[#e8e2d9]">
        <div className="mx-auto w-full max-w-[1440px] px-8 pb-10 pt-12 sm:px-10 lg:px-14 xl:px-20">
          <div className="grid grid-cols-1 gap-y-10 xl:grid-cols-[180px_160px_170px_160px_1fr_110px] xl:gap-x-8">
            <div className="xl:pt-1">
              <Link
                href="/"
                className="font-serif text-[34px] font-semibold tracking-[0.07em] text-[#faf9f6]"
              >
                FITXO
              </Link>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#faf9f6]">
                  {column.title}
                </h3>

                <ul className="mt-5 space-y-[10px] text-[14px] leading-[1.45] text-[#a99f92]">
                  {column.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="transition duration-200 hover:text-[#faf9f6]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="min-w-0">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#faf9f6]">
                Socials
              </h3>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <SocialButton href={socialLinks.facebook} label="Facebook">
                  <FacebookIcon />
                </SocialButton>
                <SocialButton href={socialLinks.twitter} label="Twitter">
                  <TwitterIcon />
                </SocialButton>
                <SocialButton href={socialLinks.instagram} label="Instagram">
                  <InstagramIcon />
                </SocialButton>
                <SocialButton href={socialLinks.tiktok} label="TikTok">
                  <TikTokIcon />
                </SocialButton>
                <SocialButton href={socialLinks.snapchat} label="Snapchat">
                  <SnapchatIcon />
                </SocialButton>
              </div>

              <div className="mt-10 max-w-[760px]">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#faf9f6]">
                  Sign Up For Fitxo Style News
                </h3>

                <form
                  onSubmit={handleSubmit}
                  className="mt-4 flex w-full max-w-[520px] flex-col gap-3 rounded-full border border-white/15 bg-white/[0.06] p-1.5 backdrop-blur-sm transition duration-200 focus-within:border-white/40 focus-within:bg-white/[0.09] sm:flex-row sm:items-center"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email address"
                    className="h-[46px] min-w-0 flex-1 bg-transparent px-5 text-[14px] text-[#faf9f6] outline-none placeholder:text-white/40"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-[46px] shrink-0 rounded-full bg-[#faf9f6] px-7 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#221b13] transition duration-200 hover:bg-[#e6dac8] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Subscribing..." : "Subscribe"}
                  </button>
                </form>
                {error ? (
                  <p className="mt-3 text-[12px] text-[#e08663]">{error}</p>
                ) : null}

                <p className="mt-4 max-w-[720px] text-[12px] leading-6 text-[#8f8578]">
                  By clicking the SUBSCRIBE button, you are agreeing to our{" "}
                  <Link
                    href="/privacy-policy"
                    className="font-medium text-[#cbb9a4] underline"
                  >
                    Privacy & Cookie Policy
                  </Link>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#faf9f6]">
                Platforms
              </h3>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <StoreBadge href="https://play.google.com" top="Get it on" bottom="Google Play">
                  <GooglePlayIcon />
                </StoreBadge>
                <StoreBadge href="https://www.apple.com/app-store/" top="Download on the" bottom="App Store">
                  <AppleIcon />
                </StoreBadge>
              </div>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-y-10 xl:grid-cols-[1fr_480px] xl:gap-x-12">
            <div>
              <div className="flex flex-wrap items-center text-[13px] text-[#a99f92]">
                {legalLinksTop.map((item, index) => (
                  <div key={item.label} className="flex items-center">
                    <Link
                      href={item.href}
                      className="transition duration-200 hover:text-[#faf9f6] hover:underline"
                    >
                      {item.label}
                    </Link>
                    {index !== legalLinksTop.length - 1 && (
                      <span className="mx-3 text-white/20">|</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center text-[13px] text-[#a99f92]">
                {legalLinksBottom.map((item, index) => (
                  <div key={item.label} className="flex items-center">
                    <Link
                      href={item.href}
                      className="transition duration-200 hover:text-[#faf9f6] hover:underline"
                    >
                      {item.label}
                    </Link>
                    {index !== legalLinksBottom.length - 1 && (
                      <span className="mx-3 text-white/20">|</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-[#a99f92]">
                {supportLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="transition duration-200 hover:text-[#faf9f6]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#faf9f6]">
                We Accept
              </h3>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {paymentItems.map((item) => (
                  <PaymentBadge key={item} label={item} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-center text-[13px] text-[#a99f92]">
            ©2026 Fitxo. All Rights Reserved.
          </div>
        </div>
      </footer>

      <NewsletterModal
        isOpen={Boolean(toastMessage)}
        message={toastMessage}
        onClose={() => setToastMessage("")}
      />
    </>
  );
}
