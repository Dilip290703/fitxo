"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CartDeliveryInfo } from "@/components/cart/DeliveryInfo";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { PriceSummary } from "@/components/cart/PriceSummary";
import { useCart } from "@/components/cart/CartProvider";
import { useLocation } from "@/store/locationStore";
import { placeOrder } from "@/app/checkout/actions";

const PAYMENT_METHODS = ["UPI", "Card", "Pay Later", "Cash on Delivery"] as const;

export function CheckoutPageView() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { selectedPincode, deliveryStatus, hasChecked } = useLocation();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discount = items.length > 0 ? 300 : 0;
  const total = Math.max(0, Math.round(subtotal - discount));

  const deliveryBlocked = hasChecked && !deliveryStatus.available;
  const canPay = !deliveryBlocked && items.length > 0 && selectedMethod !== null && !isProcessing;

  const pincodeDisplay = /^\d{6}$/.test(selectedPincode) ? selectedPincode : "Not set";

  async function handlePlaceOrder() {
    if (!canPay || !selectedMethod) return;
    setIsProcessing(true);
    setError(null);

    const result = await placeOrder(items, selectedMethod);

    if (!result.success) {
      setError(result.error);
      setIsProcessing(false);
      return;
    }

    clearCart();
    router.push(`/order-confirmation/${result.orderId}`);
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
            Checkout
          </p>
          <h1 className="mt-3 font-display text-[42px] leading-none text-[#171717]">
            Finish your FitZo try-on order.
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            {/* Delivery details */}
            <section className="rounded-[22px] border border-[#ece4da] bg-white p-6">
              <h2 className="text-[20px] font-medium text-[#171717]">Delivery details</h2>
              <p className="mt-4 text-[14px] leading-7 text-[#5f5851]">
                Pincode: {pincodeDisplay}
                <br />
                Pune, Maharashtra
              </p>

              {deliveryBlocked && (
                <div className="mt-4 rounded-[12px] bg-[#fdecea] px-4 py-3 text-[13px] text-[#c0392b]">
                  <strong>FitZo currently serves Pune locations only.</strong>
                  <br />
                  Please go back and update your pincode to a Pune area to proceed.
                </div>
              )}
              {!hasChecked && (
                <div className="mt-4 rounded-[12px] bg-[#fff8e1] px-4 py-3 text-[13px] text-[#856d00]">
                  No pincode saved. Go back to your bag and set a delivery pincode.
                </div>
              )}
            </section>

            {/* Payment method */}
            <section className="rounded-[22px] border border-[#ece4da] bg-white p-6">
              <h2 className="text-[20px] font-medium text-[#171717]">Payment method</h2>
              <p className="mt-1 text-[13px] text-[#8b7058]">
                You&apos;ll only be charged for items you decide to keep.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={deliveryBlocked}
                    onClick={() => setSelectedMethod(method)}
                    className={[
                      "rounded-[16px] border px-4 py-4 text-left text-[14px] font-medium transition duration-200",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      selectedMethod === method
                        ? "border-[#171d2b] bg-[#171d2b] text-white"
                        : "border-[#ddd4c9] bg-[#fbfaf7] text-[#171717] hover:border-[#171d2b]",
                    ].join(" ")}
                  >
                    {method}
                  </button>
                ))}
              </div>
              {!selectedMethod && !deliveryBlocked && items.length > 0 && (
                <p className="mt-3 text-[12px] text-[#8b7058]">
                  Select a payment method to continue.
                </p>
              )}
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

            {error && (
              <div className="rounded-[12px] bg-[#fdecea] px-4 py-3 text-[13px] text-[#c0392b]">
                {error}
              </div>
            )}
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
              label={
                deliveryBlocked
                  ? "Update Pincode to Continue"
                  : !selectedMethod
                  ? "Select a Payment Method"
                  : isProcessing
                  ? "Placing order…"
                  : `Place Order — ₹${total}`
              }
              onClick={handlePlaceOrder}
              disabled={!canPay}
            />
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}
