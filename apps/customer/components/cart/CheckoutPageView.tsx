"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CartDeliveryInfo } from "@/components/cart/DeliveryInfo";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { PriceSummary } from "@/components/cart/PriceSummary";
import { LoginRequiredModal } from "@/components/cart/LoginRequiredModal";
import { CelebrationOverlay } from "@/components/cart/CelebrationOverlay";
import { useCart } from "@/components/cart/CartProvider";
import { useLocation } from "@/store/locationStore";
import { AddressSection } from "@/components/checkout/AddressSection";
import type { DeliveryAddress } from "@/lib/addresses";
import { getDeliveryStatus } from "@/lib/pincode";
import { placeOrder } from "@/app/checkout/actions";

// COD hidden 2026-07 (agent rework Phase 3, owner-approved): the keep-payment
// flow is Razorpay-only and riders have no cash-collection step, so a COD order
// could never settle. Re-add "Cash on Delivery" only alongside a rider cash
// ledger. (checkout/actions.ts keeps the 'cod' mapping for old orders.)
const PAYMENT_METHODS = ["UPI", "Card", "Pay Later"] as const;

export function CheckoutPageView() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { selectedPincode } = useLocation();
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Delivery fee from Admin → System Settings (free above the threshold). Mirrors
  // the server-side calc in placeOrder so what the customer sees matches the order.
  const [feeCfg, setFeeCfg] = useState<{ fee: number; freeAbove: number }>({ fee: 0, freeAbove: 0 });
  useEffect(() => {
    createClient()
      .from("system_settings")
      .select("delivery_fee, free_delivery_above")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) =>
        setFeeCfg({
          fee: Number(data?.delivery_fee ?? 0),
          freeAbove: Number(data?.free_delivery_above ?? 0),
        }),
      );
  }, []);

  // No fake discounts — what's shown here must equal what placeOrder writes.
  const discount = 0;
  const deliveryFee = feeCfg.freeAbove > 0 && subtotal >= feeCfg.freeAbove ? 0 : feeCfg.fee;
  const total = Math.max(0, Math.round(subtotal - discount + deliveryFee));

  // Serviceability is judged on the SELECTED ADDRESS (Blinkit-style) — the
  // address form already refuses non-Pune pincodes, this is belt and braces.
  const deliveryBlocked = address !== null && !getDeliveryStatus(address.pincode).available;
  const canPay =
    !deliveryBlocked &&
    items.length > 0 &&
    address !== null &&
    selectedMethod !== null &&
    !isProcessing;

  async function handlePlaceOrder() {
    if (!canPay || !selectedMethod || !address) return;
    setIsProcessing(true);
    setError(null);

    // Gate on auth up front so we can show a friendly modal instead of an error.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsProcessing(false);
      setShowLogin(true);
      return;
    }

    const result = await placeOrder(items, selectedMethod, address.id);

    if (!result.success) {
      setError(result.error);
      setIsProcessing(false);
      return;
    }

    // Celebrate, then redirect (CelebrationOverlay calls onComplete).
    clearCart();
    setPlacedOrderId(result.orderId);
    setCelebrating(true);
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
            {/* Delivery address (Blinkit-style: saved card + quick-switch + add-new) */}
            <AddressSection
              fallbackPincode={selectedPincode}
              selected={address}
              onSelect={setAddress}
            />
            {deliveryBlocked && (
              <div className="rounded-[12px] bg-[#fdecea] px-4 py-3 text-[13px] text-[#c0392b]">
                <strong>FitZo currently serves Pune locations only.</strong>
                <br />
                Pick or add an address with a Pune pincode to proceed.
              </div>
            )}

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

            <PriceSummary subtotal={subtotal} discount={discount} delivery={deliveryFee} />

            <CheckoutButton
              label={
                deliveryBlocked
                  ? "Pick a Pune Address to Continue"
                  : !address
                  ? "Add a Delivery Address"
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

      <LoginRequiredModal open={showLogin} onClose={() => setShowLogin(false)} />

      <CelebrationOverlay
        show={celebrating}
        onComplete={() => {
          if (placedOrderId) router.push(`/order-confirmation/${placedOrderId}`);
        }}
      />
    </main>
  );
}
