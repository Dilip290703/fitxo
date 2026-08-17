import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – FitXo",
  description:
    "Learn how FitXo collects, uses, and protects your personal information during try-before-you-buy fashion delivery.",
};

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: [
      {
        subtitle: "Personal Information",
        text: "When you create an account, place an order, or contact our support team, we may collect your name, email address, phone number, delivery address, and pincode. For try-on orders, we also collect your chosen delivery slot and sizing preferences.",
      },
      {
        subtitle: "Payment Information",
        text: "Payment details such as UPI IDs, card information, and wallet data are processed securely through our payment partners (Razorpay, Paytm, PhonePe). FitXo does not store your full card numbers or CVV on our servers.",
      },
      {
        subtitle: "Device & Usage Data",
        text: "We automatically collect device type, browser, IP address, pages visited, and interaction patterns to improve the FitXo experience. Cookies and similar technologies help us remember your preferences and deliver relevant content.",
      },
      {
        subtitle: "Location Data",
        text: "With your consent, we use your pincode and approximate location to show nearby partner stores, estimate delivery times, and provide hyper-local fashion recommendations.",
      },
    ],
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: [
      {
        subtitle: "Order Fulfilment",
        text: "We use your information to process orders, coordinate slot-based deliveries, manage doorstep try-ons, handle on-the-spot returns, and process payments for items you choose to keep.",
      },
      {
        subtitle: "Personalization",
        text: "Your browsing history, size preferences, and past orders help us curate style recommendations, show relevant collections, and improve your overall shopping experience.",
      },
      {
        subtitle: "Communication",
        text: "We send order confirmations, delivery updates, return pickup notifications, and promotional offers. You can opt out of marketing communications at any time through your account settings or by clicking unsubscribe.",
      },
      {
        subtitle: "Platform Improvement",
        text: "Aggregated, anonymized data helps us analyse trends, improve delivery logistics, enhance our product catalogue, and develop new features for a better try-before-you-buy experience.",
      },
    ],
  },
  {
    id: "data-sharing",
    title: "3. Data Sharing & Third Parties",
    content: [
      {
        subtitle: "Partner Stores",
        text: "We share relevant order details (items, size, delivery address) with our partner stores and local boutiques to fulfil your try-on requests. Partners are contractually bound to protect your data.",
      },
      {
        subtitle: "Delivery Partners",
        text: "Delivery personnel receive your name, phone number, address, and order details necessary to complete the doorstep delivery and pickup. They do not have access to your payment information.",
      },
      {
        subtitle: "Payment Processors",
        text: "Payment information is shared with certified PCI-DSS compliant payment gateways for secure transaction processing.",
      },
      {
        subtitle: "Legal Requirements",
        text: "We may disclose your information if required by law, court order, or governmental request, or if necessary to protect the rights, property, or safety of FitXo, our users, or others.",
      },
    ],
  },
  {
    id: "cookies",
    title: "4. Cookies & Tracking",
    content: [
      {
        subtitle: "Essential Cookies",
        text: "Required for the platform to function — session management, shopping cart, authentication, and security features. These cannot be disabled.",
      },
      {
        subtitle: "Analytics Cookies",
        text: "Help us understand how users interact with FitXo, which pages are most visited, and where improvements are needed. We use privacy-respecting analytics tools.",
      },
      {
        subtitle: "Preference Cookies",
        text: "Remember your settings like pincode, preferred categories, and display preferences so you don't need to reconfigure them each visit.",
      },
      {
        subtitle: "Managing Cookies",
        text: "You can manage or disable cookies through your browser settings. Note that disabling essential cookies may affect platform functionality. To manage cookie preferences, visit your browser's privacy settings.",
      },
    ],
  },
  {
    id: "data-security",
    title: "5. Data Security",
    content: [
      {
        subtitle: "Encryption",
        text: "All data transmitted between your device and FitXo servers is encrypted using TLS 1.3. Sensitive data at rest is encrypted using AES-256 industry-standard encryption.",
      },
      {
        subtitle: "Access Controls",
        text: "We implement strict role-based access controls. Only authorized personnel with a legitimate business need can access personal data, and all access is logged and audited.",
      },
      {
        subtitle: "Incident Response",
        text: "In the unlikely event of a data breach, we will notify affected users within 72 hours as required by applicable data protection laws, along with steps taken to mitigate the impact.",
      },
    ],
  },
  {
    id: "your-rights",
    title: "6. Your Rights",
    content: [
      {
        subtitle: "Access & Correction",
        text: "You can access, review, and update your personal information at any time through your FitXo account settings or by contacting our support team.",
      },
      {
        subtitle: "Data Deletion",
        text: "You may request deletion of your account and associated personal data. We will process deletion requests within 30 days, except where retention is required by law or for legitimate business purposes.",
      },
      {
        subtitle: "Data Portability",
        text: "You have the right to request a copy of your personal data in a structured, commonly used format.",
      },
      {
        subtitle: "Opt-Out",
        text: "You can opt out of promotional communications, personalised recommendations, and non-essential data collection at any time.",
      },
    ],
  },
  {
    id: "data-retention",
    title: "7. Data Retention",
    content: [
      {
        subtitle: "Active Accounts",
        text: "We retain your personal data for as long as your account is active and as needed to provide you services, comply with legal obligations, and resolve disputes.",
      },
      {
        subtitle: "Inactive Accounts",
        text: "Data from accounts inactive for more than 24 months may be anonymized or deleted, with prior notification sent to your registered email address.",
      },
      {
        subtitle: "Transaction Records",
        text: "Order and payment records are retained for 8 years as required by Indian tax and commercial laws.",
      },
    ],
  },
  {
    id: "childrens-privacy",
    title: "8. Children's Privacy",
    content: [
      {
        subtitle: "",
        text: "FitXo is not intended for children under 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately and we will take steps to delete such information.",
      },
    ],
  },
  {
    id: "changes",
    title: "9. Changes to This Policy",
    content: [
      {
        subtitle: "",
        text: "We may update this Privacy Policy from time to time. Material changes will be communicated via email or a prominent notice on the platform at least 14 days before they take effect. Your continued use of FitXo after changes constitutes acceptance of the updated policy.",
      },
    ],
  },
  {
    id: "contact",
    title: "10. Contact Us",
    content: [
      {
        subtitle: "",
        text: "For any questions, concerns, or requests regarding this Privacy Policy or your personal data, please reach out to us:",
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#ece4d8] bg-[#f4f1ea] px-6 py-20 sm:px-10 lg:px-14">
        <div className="absolute left-[-140px] top-[-140px] h-80 w-80 rounded-full bg-[#ffd36a]/20 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-100px] h-72 w-72 rounded-full bg-[#ffc2a6]/25 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-[#8a7b6d]">
            Legal
          </p>
          <h1 className="mt-5 font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-[#171717] sm:text-[56px] lg:text-[64px]">
            Privacy Policy
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-8 text-[#5a554f]">
            Your trust is the fabric of our platform. This policy explains how
            FitXo collects, uses, safeguards, and shares your personal
            information when you use our try-before-you-buy fashion delivery
            service in Pune.
          </p>
          <p className="mt-4 text-[13px] text-[#8a8279]">
            Last updated: May 2026 &nbsp;·&nbsp; Effective from: May 19, 2026
          </p>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="border-b border-[#ece4d8] bg-white px-6 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
            Quick navigation
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] text-[#3a3630] transition duration-200 hover:bg-[#f4f1ea]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#d4c9bb] transition duration-200 group-hover:bg-[#111]" />
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="px-6 py-16 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl space-y-16">
          {sections.map((section) => (
            <div key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-display text-[28px] font-medium leading-[1.1] tracking-[-0.03em] text-[#171717] sm:text-[34px]">
                {section.title}
              </h2>
              <div className="mt-6 space-y-6">
                {section.content.map((item, idx) => (
                  <div key={idx}>
                    {item.subtitle && (
                      <h3 className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#6b6359]">
                        {item.subtitle}
                      </h3>
                    )}
                    <p
                      className={`${item.subtitle ? "mt-2" : ""} text-[15px] leading-[1.9] text-[#4a453f]`}
                    >
                      {item.text}
                    </p>
                  </div>
                ))}

                {/* Contact details for the last section */}
                {section.id === "contact" && (
                  <div className="rounded-2xl border border-[#ece4d8] bg-[#fbfaf7] p-6 sm:p-8">
                    <div className="space-y-3 text-[15px] leading-[1.9] text-[#4a453f]">
                      <p>
                        <strong>Email:</strong>{" "}
                        <a
                          href="mailto:privacy@fitxo.co.in"
                          className="text-[#3e6dd2] underline"
                        >
                          privacy@fitxo.co.in
                        </a>
                      </p>
                      <p>
                        <strong>Phone:</strong> +91 98765 43210
                      </p>
                      <p>
                        <strong>Address:</strong> FitXo Privacy Team, Baner
                        Road, Pune, Maharashtra 411045
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
