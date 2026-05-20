"use client";

import { useState } from "react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CartDeliveryInfo } from "@/components/cart/DeliveryInfo";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { PriceSummary } from "@/components/cart/PriceSummary";
import { useCart } from "@/components/cart/CartProvider";

export function CheckoutPageView() {
  const { items, subtotal } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const discount = items.length > 0 ? 300 : 0;
  const total = Math.max(0, Math.round(subtotal - discount));

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
            Checkout
          </p>
          <h1 className="mt-3 font-display text-[42px] leading-none text-[#171717]">
            Finish your FitZo try-at-home order.
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <section className="rounded-[22px] border border-[#ece4da] bg-white p-6">
              <h2 className="text-[20px] font-medium text-[#171717]">Delivery details</h2>
              <p className="mt-4 text-[14px] leading-7 text-[#5f5851]">
                Dilip · 411021
                <br />
                Navkar Avenue, DSK Ranwara Road
                <br />
                Pune, Maharashtra
              </p>
            </section>

            <section className="rounded-[22px] border border-[#ece4da] bg-white p-6">
              <h2 className="text-[20px] font-medium text-[#171717]">Payment method</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {["UPI", "Card", "Pay Later", "Cash on Delivery"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className="rounded-[16px] border border-[#ddd4c9] bg-[#fbfaf7] px-4 py-4 text-left text-[14px] font-medium text-[#171717] transition duration-200 hover:border-[#171d2b]"
                  >
                    {method}
                  </button>
                ))}
              </div>
            </section>

            <CartDeliveryInfo />

            <section className="rounded-[22px] bg-[#f4ede4] p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
                Try First, Pay Later
              </p>
              <p className="mt-3 text-[18px] font-medium text-[#171717]">
                Keep only what works for you.
              </p>
              <p className="mt-3 text-[14px] leading-7 text-[#5f5851]">
                You will only be billed for what you keep after your at-home try-on window closes.
              </p>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[22px] border border-[#ece4da] bg-white px-6 py-6">
              <h2 className="text-[22px] font-display leading-none text-[#171717]">
                Order Summary
              </h2>
              <div className="mt-5 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 text-[14px] text-[#3b3732]"
                  >
                    <span className="line-clamp-1">
                      {item.title} × {item.quantity}
                    </span>
                    <span>{item.displayPrice}</span>
                  </div>
                ))}
              </div>
            </div>

            <PriceSummary subtotal={subtotal} discount={discount} />
            <CheckoutButton
              label={isProcessing ? "Processing..." : `Pay ₹${total}`}
              onClick={() => {
                setIsProcessing(true);
                window.setTimeout(() => setIsProcessing(false), 1800);
              }}
              disabled={isProcessing || items.length === 0}
            />
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}
