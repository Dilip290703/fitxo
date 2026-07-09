"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { NewsletterModal } from "@/components/NewsletterModal";
import { socialLinks, supportLinks } from "@/lib/mockData";

const footerColumns = [
  {
    title: "Company Info",
    items: [
      { label: "About Fitzo", href: "/about" },
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

function AndroidIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[30px] w-[30px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7.2 8.2h9.6a3 3 0 013 3v5.1h-1.9V19a.9.9 0 11-1.8 0v-2.7h-1.3V19a.9.9 0 11-1.8 0v-2.7h-1.1V19a.9.9 0 11-1.8 0v-2.7H8V19a.9.9 0 11-1.8 0v-2.7H4.3v-5.1a3 3 0 013-3zm2-4l1 1.8h3.5l1-1.8.8.4-.9 1.6c.8.3 1.5.8 2 1.4H7.4c.5-.6 1.2-1.1 2-1.4l-.9-1.6.7-.4zm.3 2.3a.7.7 0 100-1.4.7.7 0 000 1.4zm5 0a.7.7 0 100-1.4.7.7 0 000 1.4z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[30px] w-[30px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.7 12.4c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.3.8-3 .8-.7 0-1.6-.8-2.6-.8-1.4 0-2.7.8-3.4 2-1.4 2.4-.4 6.1 1 8.1.7 1.1 1.5 2.1 2.6 2.1 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-.9 2.6-1.9.8-1.2 1.1-2.2 1.1-2.3 0 0-2.8-1.1-2.8-3.4zM14.8 6.1c.6-.7.9-1.7.8-2.6-.8 0-1.8.5-2.4 1.2-.6.7-1 1.6-.9 2.5.9.1 1.9-.5 2.5-1.1z" />
    </svg>
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
      className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[#293245] text-[#1d2433] transition duration-200 hover:border-[#111827] hover:text-[#111827]"
    >
      {children}
    </a>
  );
}

function PaymentBadge({ label }: { label: string }) {
  return (
    <span className="flex h-[34px] items-center justify-center rounded-[2px] border border-[#d7d1c8] bg-[#faf9f7] px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[#2c2c2c]">
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
      <footer id="footer" className="bg-[#f3f3f3] text-[#273041]">
        <div className="mx-auto w-full max-w-[1440px] px-8 pb-10 pt-12 sm:px-10 lg:px-14 xl:px-20">
          <div className="grid grid-cols-1 gap-y-10 xl:grid-cols-[180px_160px_170px_160px_1fr_110px] xl:gap-x-8">
            <div className="xl:pt-1">
              <Link
                href="/"
                className="font-serif text-[34px] font-semibold tracking-[0.07em] text-[#161d2b]"
              >
                FITZO
              </Link>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2b3342]">
                  {column.title}
                </h3>

                <ul className="mt-5 space-y-[10px] text-[14px] leading-[1.45] text-[#767d89]">
                  {column.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="transition duration-200 hover:text-[#111827]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="min-w-0">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2b3342]">
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
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2b3342]">
                  Sign Up For Fitzo Style News
                </h3>

                <form
                  onSubmit={handleSubmit}
                  className="mt-4 flex w-full flex-col gap-3 md:flex-row"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Your email"
                    className="h-[48px] min-w-0 flex-1 border border-[#afb6c0] bg-transparent px-5 text-[14px] text-[#404855] outline-none placeholder:text-[#8b939f] transition duration-200 focus:border-[#263041]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-[48px] min-w-[170px] bg-[#221b13] px-6 text-[13px] font-medium uppercase tracking-[0.08em] text-white transition duration-200 hover:bg-[#151e2d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Subscribing..." : "Subscribe"}
                  </button>
                </form>
                {error ? (
                  <p className="mt-3 text-[12px] text-[#c0392b]">{error}</p>
                ) : null}

                <p className="mt-4 max-w-[720px] text-[12px] leading-6 text-[#77716b]">
                  By clicking the SUBSCRIBE button, you are agreeing to our{" "}
                  <Link
                    href="/privacy-policy"
                    className="font-medium text-[#3e6dd2] underline"
                  >
                    Privacy & Cookie Policy
                  </Link>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2b3342]">
                Platforms
              </h3>

              <div className="mt-5 flex items-center gap-5 text-[#221b13]">
                <a
                  href="https://play.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="transition duration-200 hover:opacity-80"
                >
                  <AndroidIcon />
                </a>
                <a
                  href="https://www.apple.com/app-store/"
                  target="_blank"
                  rel="noreferrer"
                  className="transition duration-200 hover:opacity-80"
                >
                  <AppleIcon />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-y-10 xl:grid-cols-[1fr_480px] xl:gap-x-12">
            <div>
              <p className="text-[13px] text-[#767d89]">
                ©2026 Fitzo All Rights Reserved
              </p>

              <div className="mt-8 flex flex-wrap items-center text-[13px] text-[#767d89]">
                {legalLinksTop.map((item, index) => (
                  <div key={item.label} className="flex items-center">
                    <Link
                      href={item.href}
                      className="transition duration-200 hover:text-[#111827] hover:underline"
                    >
                      {item.label}
                    </Link>
                    {index !== legalLinksTop.length - 1 && (
                      <span className="mx-3 text-[#c0b9b0]">|</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center text-[13px] text-[#767d89]">
                {legalLinksBottom.map((item, index) => (
                  <div key={item.label} className="flex items-center">
                    <Link
                      href={item.href}
                      className="transition duration-200 hover:text-[#111827] hover:underline"
                    >
                      {item.label}
                    </Link>
                    {index !== legalLinksBottom.length - 1 && (
                      <span className="mx-3 text-[#c0b9b0]">|</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-[#767d89]">
                {supportLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="transition duration-200 hover:text-[#111827]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2b3342]">
                We Accept
              </h3>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {paymentItems.map((item) => (
                  <PaymentBadge key={item} label={item} />
                ))}
              </div>
            </div>
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
