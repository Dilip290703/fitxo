"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CartItem } from "@/components/cart/CartItem";
import { CartDeliveryInfo } from "@/components/cart/DeliveryInfo";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { PriceSummary } from "@/components/cart/PriceSummary";
import { RecommendedProducts } from "@/components/cart/RecommendedProducts";
import { useCart } from "@/components/cart/CartProvider";
import { useLiveRecommendations } from "@/components/cart/useLiveRecommendations";
import { PincodeModal } from "@/components/PincodeModal";
import { useLocation } from "@/store/locationStore";

export function BagPageView() {
  const router = useRouter();
  const { items, subtotal } = useCart();
  const { selectedPincode, setPincode, deliveryStatus, hasChecked } = useLocation();
  const [isPincodeOpen, setIsPincodeOpen] = useState(false);

  const bagIds = useMemo(() => items.map((item) => item.id), [items]);
  const recommendedProducts = useLiveRecommendations(6, bagIds);

  // The old CouponCard was a fake: one tap knocked a flat ₹300 off this page's
  // display while the server-side order ignored it — the customer would see
  // one price here and be charged another. No coupon UI until redemption is
  // actually wired to the coupons table.
  const finalTotal = subtotal;

  // A pincode has been saved but it's not in Pune
  const deliveryBlocked = hasChecked && !deliveryStatus.available;

  const handleCheckout = () => {
    if (deliveryBlocked) return;
    router.push("/checkout");
  };

  // Display label for the delivery address section
  const pincodeLabel = /^\d{6}$/.test(selectedPincode) ? selectedPincode : "Not set";

  return (
    <>
      <main className="min-h-screen bg-[#fbfaf7] pb-24 sm:pb-0">
        <Navbar showSecondaryNav={false} />

        <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
          <div className="mb-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
              Your Bag
            </p>
            <h1 className="mt-3 font-display text-[44px] leading-none text-[#171717]">
              Everything you want to try on at your door.
            </h1>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[28px] border border-[#ece4da] bg-white px-6 py-14 text-center">
              <h2 className="font-display text-[34px] leading-none text-[#171717]">
                Your bag is empty.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[#5f5851]">
                Add a few looks and compare them at your door before deciding what to keep.
              </p>
              <CheckoutButton
                href="/products"
                label="Browse Products"
                className="mt-8 w-auto px-8"
              />
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">
              <div className="space-y-5">
                {items.map((item) => (
                  <CartItem key={item.key} item={item} />
                ))}

                <section className="rounded-[22px] bg-[#f4ede4] p-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
                    Try First, Pay Later
                  </p>
                  <p className="mt-3 text-[18px] font-medium text-[#171717]">
                    Keep only what you love.
                  </p>
                  <p className="mt-3 text-[14px] leading-7 text-[#5f5851]">
                    Hand returns straight back to the rider, zero pressure to keep anything that doesn&apos;t fit, and delivery-slot booking from nearby stores.
                  </p>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                {/* Pincode / delivery address */}
                <div className="rounded-[22px] border border-[#ece4da] bg-white px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
                        Delivering to
                      </p>
                      <p className="mt-2 text-[15px] font-medium leading-6 text-[#171717]">
                        {pincodeLabel}
                      </p>
                      {hasChecked ? (
                        <p
                          className={`mt-1 text-[13px] ${
                            deliveryStatus.available
                              ? "text-[#388e3c]"
                              : "text-[#c0392b]"
                          }`}
                        >
                          {deliveryStatus.message}
                        </p>
                      ) : (
                        <p className="mt-1 text-[13px] text-[#5f5851]">
                          Set your pincode to confirm availability.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPincodeOpen(true)}
                      className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#171717] transition duration-200 hover:text-black"
                    >
                      {hasChecked ? "Change" : "Set"}
                    </button>
                  </div>
                </div>

                <CartDeliveryInfo />

                <PriceSummary subtotal={subtotal} discount={0} />

                {/* Checkout CTA — disabled if pincode is set but not serviceable */}
                {deliveryBlocked ? (
                  <div className="space-y-2">
                    <div className="rounded-[14px] bg-[#fdecea] px-4 py-3 text-center text-[13px] text-[#c0392b]">
                      FitXo serves Pune locations only. Please update your pincode.
                    </div>
                    <CheckoutButton
                      label="Proceed to Checkout"
                      onClick={() => setIsPincodeOpen(true)}
                      className="opacity-60"
                    />
                  </div>
                ) : (
                  <CheckoutButton
                    label="Proceed to Checkout"
                    onClick={handleCheckout}
                  />
                )}
              </aside>
            </div>
          )}
        </section>

        {recommendedProducts.length > 0 ? (
          <section className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8 xl:px-10">
            <RecommendedProducts
              title="Worth Adding"
              products={recommendedProducts}
              layout="carousel"
            />
          </section>
        ) : null}

        <Footer />
      </main>

      {/* Mobile sticky bar */}
      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8dfd5] bg-[#fbfaf7]/95 px-4 py-3 backdrop-blur sm:hidden">
          <div className="mb-2 flex items-center justify-between text-[13px] text-[#5f5851]">
            <span>Grand Total</span>
            <span className="font-semibold text-[#171717]">₹{Math.round(finalTotal)}</span>
          </div>
          <CheckoutButton
            label="Proceed to Checkout"
            onClick={handleCheckout}
            disabled={deliveryBlocked}
          />
        </div>
      ) : null}

      <PincodeModal
        isOpen={isPincodeOpen}
        onClose={() => setIsPincodeOpen(false)}
        onSave={setPincode}
        currentValue={selectedPincode}
      />
    </>
  );
}
