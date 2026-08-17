import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions – FitXo",
  description:
    "Read the terms and conditions governing your use of FitXo's try-before-you-buy fashion delivery service in Pune.",
};

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    paragraphs: [
      "By accessing or using the FitXo platform — including our website, mobile application, and doorstep try-on services — you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the platform.",
      "FitXo reserves the right to modify these terms at any time. Material changes will be communicated via email or a prominent notice on the platform at least 14 days before they take effect. Continued use of the platform after changes constitutes acceptance.",
    ],
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    paragraphs: [
      "You must be at least 16 years of age to use FitXo. By creating an account, you represent that you meet this age requirement and that all information provided is accurate and complete.",
      "FitXo currently operates in Pune, Maharashtra. Services are available only within our active delivery zones. You can check availability by entering your pincode on the platform.",
    ],
  },
  {
    id: "account",
    title: "3. Account & Registration",
    paragraphs: [
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use.",
      "FitXo reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the try-before-you-buy service.",
    ],
  },
  {
    id: "try-before-you-buy",
    title: "4. Try-Before-You-Buy Service",
    paragraphs: [
      "FitXo's core offering allows you to order fashion items, book a delivery slot, and try them on at your door while the rider waits (typically 7 minutes), paying only for the items you choose to keep. Items you do not wish to purchase are handed back to the rider at the same visit.",
      "You are expected to handle try-on items with reasonable care. Items must be returned in the same condition as delivered — unworn (beyond trying on), with all tags and packaging intact. Items that are damaged, stained, altered, or returned without original tags may not be eligible for return.",
      "FitXo reserves the right to limit the number of items per try-on order and to restrict the service for accounts with a history of excessive returns or misuse.",
    ],
  },
  {
    id: "orders-delivery",
    title: "5. Orders & Delivery",
    paragraphs: [
      "FitXo aims to deliver orders within the delivery slot you select at checkout, subject to availability, partner store hours, and delivery zone coverage. Slot times are estimates and not guaranteed.",
      "You must provide accurate delivery address and contact details. A valid phone number is required for delivery coordination. If delivery cannot be completed due to incorrect information or recipient unavailability, re-delivery charges may apply.",
      "Order confirmation constitutes a binding agreement to receive the items for try-on. Cancellation is free if made within 5 minutes of placing the order. After dispatch, cancellation may not be possible.",
    ],
  },
  {
    id: "pricing-payments",
    title: "6. Pricing & Payments",
    paragraphs: [
      "All prices displayed on FitXo are in Indian Rupees (₹) and include applicable GST unless otherwise stated. Prices are set by our partner stores and may change without notice.",
      "Payment is collected only for items you choose to keep after your try-on. Accepted payment methods include UPI, credit/debit cards, net banking, and digital wallets.",
      "In the event of a payment failure or dispute, FitXo will work with you and our payment partners to resolve the issue. Refunds for returned items are processed within 5–7 business days to the original payment method.",
    ],
  },
  {
    id: "returns-refunds",
    title: "7. Returns & Refunds",
    paragraphs: [
      "Items not kept during a doorstep try-on are returned immediately to the delivery partner at no cost to you. For items purchased and later found to be defective or incorrect, you may initiate a return within 7 days of delivery.",
      "Refunds are processed to the original payment method within 5–7 business days after the returned item is inspected and approved. Shipping charges, if any, are non-refundable unless the return is due to a FitXo error.",
      "Certain items — including innerwear, swimwear, customized products, and items marked as final sale — are not eligible for return. These exclusions are clearly indicated on the product page.",
    ],
  },
  {
    id: "partner-stores",
    title: "8. Partner Stores",
    paragraphs: [
      "FitXo operates as a marketplace connecting you with local fashion stores and boutiques in Pune. Product quality, authenticity, and descriptions are the responsibility of partner stores.",
      "While FitXo vets partner stores and monitors quality, we act as an intermediary and are not the direct seller of products. Any warranty or guarantee on products is provided by the respective brand or store.",
    ],
  },
  {
    id: "intellectual-property",
    title: "9. Intellectual Property",
    paragraphs: [
      "All content on FitXo — including the logo, design, text, graphics, software, and user interface — is the property of FitXo or its licensors and is protected by copyright, trademark, and other intellectual property laws.",
      "You may not reproduce, distribute, modify, create derivative works of, or commercially exploit any content from the platform without prior written consent from FitXo.",
    ],
  },
  {
    id: "limitation-liability",
    title: "10. Limitation of Liability",
    paragraphs: [
      "FitXo provides the platform on an \"as-is\" and \"as-available\" basis. We do not guarantee uninterrupted, error-free, or secure access to the platform at all times.",
      "To the maximum extent permitted by law, FitXo shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform, including but not limited to loss of data, profits, or goodwill.",
      "FitXo's total liability for any claim related to the platform or service shall not exceed the amount paid by you for the specific order giving rise to the claim.",
    ],
  },
  {
    id: "prohibited-conduct",
    title: "11. Prohibited Conduct",
    paragraphs: [
      "You agree not to: use the platform for any unlawful purpose; provide false or misleading information; attempt to access other users' accounts; interfere with platform security or performance; use automated tools to scrape or collect data; resell items purchased through FitXo for commercial purposes; or abuse the try-before-you-buy service through fraudulent returns.",
    ],
  },
  {
    id: "governing-law",
    title: "12. Governing Law & Disputes",
    paragraphs: [
      "These terms are governed by the laws of India. Any dispute arising from or related to these terms or your use of FitXo shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra.",
      "Before initiating legal proceedings, you agree to attempt resolution through FitXo's customer support and, if necessary, through mediation.",
    ],
  },
  {
    id: "contact",
    title: "13. Contact",
    paragraphs: [
      "For questions about these Terms & Conditions, please contact us:",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#ece4d8] bg-[#f4f1ea] px-6 py-20 sm:px-10 lg:px-14">
        <div className="absolute right-[-160px] top-[-100px] h-80 w-80 rounded-full bg-[#c2d6fb]/25 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[-100px] h-72 w-72 rounded-full bg-[#ffd36a]/15 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-[#8a7b6d]">
            Legal
          </p>
          <h1 className="mt-5 font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-[#171717] sm:text-[56px] lg:text-[64px]">
            Terms & Conditions
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-8 text-[#5a554f]">
            These terms govern your use of FitXo — the try-before-you-buy
            fashion delivery platform operating in Pune, Maharashtra. Please
            read them carefully before using our services.
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
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Content */}
      <section className="px-6 py-16 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl space-y-16">
          {sections.map((section) => (
            <div key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-display text-[28px] font-medium leading-[1.1] tracking-[-0.03em] text-[#171717] sm:text-[34px]">
                {section.title}
              </h2>
              <div className="mt-6 space-y-4">
                {section.paragraphs.map((text, idx) => (
                  <p
                    key={idx}
                    className="text-[15px] leading-[1.9] text-[#4a453f]"
                  >
                    {text}
                  </p>
                ))}

                {section.id === "contact" && (
                  <div className="rounded-2xl border border-[#ece4d8] bg-[#fbfaf7] p-6 sm:p-8">
                    <div className="space-y-3 text-[15px] leading-[1.9] text-[#4a453f]">
                      <p>
                        <strong>Email:</strong>{" "}
                        <a
                          href="mailto:legal@fitxo.co.in"
                          className="text-[#3e6dd2] underline"
                        >
                          legal@fitxo.co.in
                        </a>
                      </p>
                      <p>
                        <strong>Phone:</strong> +91 98765 43210
                      </p>
                      <p>
                        <strong>Address:</strong> FitXo Legal, Baner Road, Pune,
                        Maharashtra 411045
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
