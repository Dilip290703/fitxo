import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy – FitZo",
  description:
    "Understand FitZo's refund and return policy for try-before-you-buy fashion delivery in Pune.",
};

const highlights = [
  {
    stat: "₹0",
    label: "Doorstep return cost",
    text: "Items returned during a try-on visit are picked up free of charge.",
  },
  {
    stat: "5–7 days",
    label: "Refund processing",
    text: "Refunds are credited to your original payment method within 5–7 business days.",
  },
  {
    stat: "7 days",
    label: "Post-purchase return window",
    text: "Changed your mind? Initiate a return within 7 days of purchase.",
  },
];

const sections = [
  {
    id: "doorstep-returns",
    title: "1. Doorstep Try-On Returns",
    content: [
      "FitZo's try-before-you-buy model means you only pay for what you keep. During a doorstep delivery, our delivery partner will wait while you try on your selected items.",
      "Items you choose not to keep are returned immediately to the delivery partner — no charges, no paperwork, no hassle. You are only charged for the items you decide to purchase.",
      "Please ensure returned items are in the same condition as delivered: unworn (beyond trying on), with all original tags, labels, and packaging intact.",
    ],
  },
  {
    id: "post-purchase-returns",
    title: "2. Post-Purchase Returns",
    content: [
      "If you purchased an item and later wish to return it, you may initiate a return within 7 days of the purchase date through your FitZo account or by contacting our support team.",
      "The item must be unworn, unwashed, undamaged, and in its original packaging with all tags attached. Once your return request is approved, we will schedule a pickup at your doorstep.",
      "Inspection of the returned item typically takes 1–2 business days after pickup. If the item passes inspection, your refund will be initiated immediately.",
    ],
  },
  {
    id: "refund-methods",
    title: "3. Refund Methods & Timeline",
    content: [
      "Refunds are processed to the original payment method used at the time of purchase:",
    ],
    table: [
      { method: "UPI (GPay, PhonePe, Paytm)", timeline: "1–3 business days" },
      { method: "Credit / Debit Card", timeline: "5–7 business days" },
      { method: "Net Banking", timeline: "5–7 business days" },
      { method: "Digital Wallets", timeline: "1–2 business days" },
    ],
    afterTable: [
      "Note: Timelines are estimates and may vary depending on your bank or payment provider. FitZo initiates the refund within 48 hours of return approval.",
    ],
  },
  {
    id: "non-returnable",
    title: "4. Non-Returnable Items",
    content: [
      "For hygiene and safety reasons, the following categories are not eligible for return or refund:",
    ],
    list: [
      "Innerwear, lingerie, and swimwear",
      "Customized or personalized items",
      "Items marked as \"Final Sale\" or \"Non-Returnable\" on the product page",
      "Accessories with broken seals (earrings, nose pins, etc.)",
      "Items that show signs of use beyond trying on (stains, odour, alterations, missing tags)",
    ],
    afterList: [
      "Non-returnable status is clearly indicated on the product page before purchase. Please review item details carefully before completing your order.",
    ],
  },
  {
    id: "damaged-defective",
    title: "5. Damaged or Defective Items",
    content: [
      "If you receive an item that is damaged, defective, or different from what you ordered, please report it within 48 hours of delivery through your FitZo account or by contacting our support team.",
      "Include clear photos of the issue for faster resolution. We will arrange a free pickup and provide a full refund or replacement, based on your preference and item availability.",
      "For defective items, FitZo covers all return shipping costs regardless of the return reason.",
    ],
  },
  {
    id: "partial-refunds",
    title: "6. Partial Refunds",
    content: [
      "In some cases, a partial refund may be issued instead of a full refund:",
    ],
    list: [
      "Items returned with minor signs of use that affect resale value",
      "Missing original packaging, tags, or accessories",
      "Items returned after the 7-day window but within 14 days (subject to a 15% restocking fee)",
    ],
    afterList: [
      "The partial refund amount is determined after item inspection and communicated to you before processing.",
    ],
  },
  {
    id: "cancellations",
    title: "7. Order Cancellations",
    content: [
      "Orders can be cancelled free of charge within 5 minutes of placement. After this window, if the order has been dispatched, cancellation may not be possible.",
      "If a dispatched order is cancelled before delivery, a ₹49 cancellation fee may apply to cover logistics costs. This fee is waived if the cancellation is due to a FitZo error or delay.",
    ],
  },
  {
    id: "disputes",
    title: "8. Refund Disputes",
    content: [
      "If you disagree with a refund decision, you may escalate the issue by contacting our support team with your order details and reason for dispute.",
      "FitZo will review the dispute within 5 business days and provide a final resolution. We are committed to fair and transparent resolution of all refund-related concerns.",
    ],
  },
  {
    id: "contact",
    title: "9. Contact for Refund Queries",
    content: [
      "For any questions about refunds, returns, or this policy:",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#ece4d8] bg-[#f4f1ea] px-6 py-20 sm:px-10 lg:px-14">
        <div className="absolute left-[-100px] top-[-120px] h-72 w-72 rounded-full bg-[#a6ffc2]/15 blur-3xl" />
        <div className="absolute bottom-[-130px] right-[-80px] h-80 w-80 rounded-full bg-[#ffd36a]/15 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-[#8a7b6d]">
            Legal
          </p>
          <h1 className="mt-5 font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-[#171717] sm:text-[56px] lg:text-[64px]">
            Refund Policy
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-8 text-[#5a554f]">
            At FitZo, our try-before-you-buy model means you should never pay
            for something that doesn't feel right. Here's exactly how returns
            and refunds work.
          </p>
          <p className="mt-4 text-[13px] text-[#8a8279]">
            Last updated: May 2026 &nbsp;·&nbsp; Effective from: May 19, 2026
          </p>
        </div>
      </section>

      {/* Highlight Stats */}
      <section className="border-b border-[#ece4d8] bg-white px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {highlights.map((item) => (
            <article
              key={item.label}
              className="rounded-[20px] border border-[#ece4d8] bg-[#fbfaf7] px-6 py-7 transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="font-display text-[36px] font-medium leading-none tracking-[-0.04em] text-[#171717]">
                {item.stat}
              </p>
              <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
                {item.label}
              </p>
              <p className="mt-3 text-[14px] leading-7 text-[#5a554f]">
                {item.text}
              </p>
            </article>
          ))}
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
                {section.content.map((text, idx) => (
                  <p
                    key={idx}
                    className="text-[15px] leading-[1.9] text-[#4a453f]"
                  >
                    {text}
                  </p>
                ))}

                {/* Refund timeline table */}
                {"table" in section && section.table && (
                  <div className="overflow-hidden rounded-2xl border border-[#ece4d8]">
                    <table className="w-full text-left text-[14px]">
                      <thead>
                        <tr className="bg-[#f4f1ea]">
                          <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6b6359]">
                            Payment Method
                          </th>
                          <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6b6359]">
                            Refund Timeline
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-[#ece4d8]"
                          >
                            <td className="px-6 py-4 text-[#4a453f]">
                              {row.method}
                            </td>
                            <td className="px-6 py-4 font-medium text-[#171717]">
                              {row.timeline}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {"afterTable" in section &&
                  section.afterTable?.map((text, idx) => (
                    <p
                      key={idx}
                      className="text-[15px] leading-[1.9] text-[#4a453f]"
                    >
                      {text}
                    </p>
                  ))}

                {/* Bullet list */}
                {"list" in section && section.list && (
                  <ul className="ml-1 space-y-2">
                    {section.list.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-[15px] leading-[1.9] text-[#4a453f]"
                      >
                        <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#b5a998]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {"afterList" in section &&
                  section.afterList?.map((text, idx) => (
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
                          href="mailto:returns@fitzo.in"
                          className="text-[#3e6dd2] underline"
                        >
                          returns@fitzo.in
                        </a>
                      </p>
                      <p>
                        <strong>Phone:</strong> +91 98765 43210
                      </p>
                      <p>
                        <strong>Address:</strong> FitZo Returns, Baner Road,
                        Pune, Maharashtra 411045
                      </p>
                    </div>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/contact"
                        className="inline-flex h-12 items-center justify-center rounded-full bg-[#221b13] px-7 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#141d2b]"
                      >
                        Contact support
                      </Link>
                      <Link
                        href="/"
                        className="inline-flex h-12 items-center justify-center rounded-full border border-[#d7cab9] bg-white px-7 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#221b13] transition duration-200 hover:bg-[#faf4eb]"
                      >
                        Back to home
                      </Link>
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
