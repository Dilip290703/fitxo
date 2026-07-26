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
import { loadRazorpayScript } from "@/lib/razorpayCheckout";
import {
  createDeliveryFeePayment,
  confirmKeepPayment,
} from "@/app/order-tracking/[orderId]/actions";

// COD hidden 2026-07 (agent rework Phase 3, owner-approved): the keep-payment
// flow is Razorpay-only and riders have no cash-collection step, so a COD order
// could never settle. Re-add "Cash on Delivery" only alongside a rider cash
// ledger. (checkout/actions.ts keeps the 'cod' mapping for old orders.)
//
// "Pay Later" dropped 2026-07-26 alongside the upfront fee move: the delivery
// fee is charged here and now via Razorpay, so offering "Pay Later" and then
// immediately opening a payment modal contradicts itself. (Part of the W3.3
// copy sweep, pulled forward.)
const PAYMENT_METHODS = ["UPI", "Card"] as const;

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
  // Set when the order was created but its delivery fee is still unpaid (the
  // customer closed the Razorpay window). The button becomes a retry so we can
  // never place a duplicate order.
  const [awaitingFeeOrderId, setAwaitingFeeOrderId] = useState<string | null>(null);

  // Delivery fee from Admin → System Settings. Mirrors the server-side calc in
  // place_order so what the customer sees matches the order:
  //   • G9 (migration 050): the fee is charged on EVERY order and paid upfront;
  //     free_delivery_above is a KEPT-value refund threshold, not a checkout
  //     waiver. first_order_free zeroes a customer's first order.
  //   • Pre-050 (probe fails): legacy display — waived when ordered subtotal
  //     crosses the threshold, matching the 049 RPC.
  const [feeCfg, setFeeCfg] = useState<{
    fee: number;
    freeAbove: number;
    upfront: boolean; // 050 applied
    firstFree: boolean; // first_order_free ON and this user has no prior orders
  }>({ fee: 0, freeAbove: 0, upfront: false, firstFree: false });
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("delivery_fee, free_delivery_above")
        .eq("id", 1)
        .maybeSingle();
      const base = {
        fee: Number(data?.delivery_fee ?? 0),
        freeAbove: Number(data?.free_delivery_above ?? 0),
      };
      // 050 probe (separate query so a missing column can't blank the basics).
      const { data: g9, error: g9Error } = await supabase
        .from("system_settings")
        .select("first_order_free")
        .eq("id", 1)
        .maybeSingle();
      let firstFree = false;
      if (!g9Error && g9?.first_order_free) {
        const { count } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled");
        firstFree = (count ?? 0) === 0;
      }
      setFeeCfg({ ...base, upfront: !g9Error, firstFree });
    })();
  }, []);

  // No fake discounts — what's shown here must equal what placeOrder writes.
  const discount = 0;
  const deliveryFee = feeCfg.upfront
    ? feeCfg.firstFree
      ? 0
      : feeCfg.fee
    : feeCfg.freeAbove > 0 && subtotal >= feeCfg.freeAbove
      ? 0
      : feeCfg.fee;
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

  /**
   * Collect the G9/050 delivery fee HERE, immediately after the order exists —
   * not later on the tracking page. The old flow placed the order, showed a
   * total that already included the fee, charged nothing, and only asked for
   * the money on a screen the customer had to navigate to. Meanwhile
   * store_confirm_order refuses to confirm until the fee is paid, so the order
   * genuinely sat frozen and looked broken.
   *
   * The order must be created first — the payment attaches to an order id — so
   * this is a UX move, not a data-flow change. Same server actions the tracking
   * card uses, which stays put as the recovery path.
   */
  async function payDeliveryFee(orderId: string) {
    setError(null);

    const payment = await createDeliveryFeePayment(orderId);
    if (!payment.success) {
      // Fee already paid (double-submit) is a success from here.
      if (/already paid/i.test(payment.error)) {
        finishPlaced(orderId);
        return;
      }
      setAwaitingFeeOrderId(orderId);
      setIsProcessing(false);
      setError(payment.error);
      return;
    }

    const ready = await loadRazorpayScript();
    if (!ready || !window.Razorpay) {
      setAwaitingFeeOrderId(orderId);
      setIsProcessing(false);
      setError("Couldn't load the payment window. Check your connection and try again.");
      return;
    }

    const rzp = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      name: "Fitzo",
      description: `Delivery fee — refunded if you keep enough after your try-on`,
      order_id: payment.rzpOrderId,
      theme: { color: "#171d2b" },
      modal: {
        ondismiss: () => {
          // The order EXISTS and holds stock + the customer's active-order slot,
          // so never silently drop them here — offer a one-tap retry instead.
          setAwaitingFeeOrderId(orderId);
          setIsProcessing(false);
          setError(
            "Payment cancelled — your order is saved but the store can't start it until the delivery fee is paid.",
          );
        },
      },
      handler: async (response) => {
        // Same verified settle path as Keep payments (HMAC re-checked in-DB).
        const result = await confirmKeepPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          orderId,
        });
        if (!result.success) {
          setAwaitingFeeOrderId(orderId);
          setIsProcessing(false);
          setError(result.error);
          return;
        }
        finishPlaced(orderId);
      },
    });

    rzp.on("payment.failed", (resp) => {
      setAwaitingFeeOrderId(orderId);
      setIsProcessing(false);
      setError(resp.error?.description ?? "Payment failed. Please try again.");
    });

    rzp.open();
  }

  /** Order placed AND paid for (or nothing to pay) — celebrate, then redirect. */
  function finishPlaced(orderId: string) {
    clearCart();
    setAwaitingFeeOrderId(null);
    setPlacedOrderId(orderId);
    setIsProcessing(false);
    setCelebrating(true);
  }

  async function handlePlaceOrder() {
    // Retry path: the order already exists, so never place a second one.
    if (awaitingFeeOrderId) {
      setIsProcessing(true);
      await payDeliveryFee(awaitingFeeOrderId);
      return;
    }

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

    // Nothing to collect (first_order_free, or a pre-050 environment) — the
    // old behaviour is still exactly right.
    if (!(feeCfg.upfront && deliveryFee > 0)) {
      finishPlaced(result.orderId);
      return;
    }

    await payDeliveryFee(result.orderId);
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
                {feeCfg.upfront && deliveryFee > 0 ? (
                  <>
                    You pay the ₹{deliveryFee.toLocaleString("en-IN")} delivery fee now — clothes are
                    charged only for what you keep after trying them on.
                  </>
                ) : (
                  <>You&apos;ll only be charged for items you decide to keep.</>
                )}
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
              {/* Must stay true now that the fee is collected here: "only billed
                  for what you keep" was accurate when nothing was charged
                  upfront, and stopped being so with G9/050. */}
              <p className="mt-3 text-[14px] leading-7 text-[#5f5851]">
                {feeCfg.upfront && deliveryFee > 0 ? (
                  <>
                    Apart from the ₹{deliveryFee.toLocaleString("en-IN")} delivery fee, you&apos;re
                    billed only for what you keep after your at-home try-on window closes.
                  </>
                ) : (
                  <>
                    You will only be billed for what you keep after your at-home try-on window
                    closes.
                  </>
                )}
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
            {feeCfg.upfront && feeCfg.firstFree && (
              <p className="mt-2 text-[12px] font-medium text-[#2f7d46]">
                First order — delivery is on us 🎉
              </p>
            )}
            {feeCfg.upfront && !feeCfg.firstFree && deliveryFee > 0 && feeCfg.freeAbove > 0 && (
              <p className="mt-2 text-[12px] leading-5 text-[#8b7058]">
                Keep items worth ₹{feeCfg.freeAbove.toLocaleString("en-IN")}+ after your try-on and
                the ₹{deliveryFee.toLocaleString("en-IN")} delivery fee is refunded.
              </p>
            )}

            {/* The summary total is the ORDER's value; only the fee is due now.
                Saying so here stops "Place Order — ₹1058" from reading as a
                ₹1058 charge, which is what made the old flow feel broken. */}
            {feeCfg.upfront && deliveryFee > 0 && (
              <p className="mt-2 text-[12px] leading-5 text-[#8b7058]">
                <strong className="font-semibold text-[#171717]">
                  ₹{deliveryFee.toLocaleString("en-IN")} due now
                </strong>{" "}
                to book the try-on. Clothes are charged only for what you keep.
              </p>
            )}

            <CheckoutButton
              label={
                awaitingFeeOrderId
                  ? isProcessing
                    ? "Opening payment…"
                    : `Pay ₹${deliveryFee.toLocaleString("en-IN")} to start your order`
                  : deliveryBlocked
                  ? "Pick a Pune Address to Continue"
                  : !address
                  ? "Add a Delivery Address"
                  : !selectedMethod
                  ? "Select a Payment Method"
                  : isProcessing
                  ? "Placing order…"
                  : feeCfg.upfront && deliveryFee > 0
                  ? `Pay ₹${deliveryFee.toLocaleString("en-IN")} & Place Order`
                  : `Place Order — ₹${total}`
              }
              onClick={handlePlaceOrder}
              disabled={awaitingFeeOrderId ? isProcessing : !canPay}
            />

            {awaitingFeeOrderId && !isProcessing && (
              <button
                type="button"
                onClick={() => router.push(`/order-tracking/${awaitingFeeOrderId}`)}
                className="mt-3 w-full text-center text-[12px] text-[#8b7058] underline-offset-4 hover:text-[#171717] hover:underline"
              >
                View the order instead — you can pay or cancel it there
              </button>
            )}
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
