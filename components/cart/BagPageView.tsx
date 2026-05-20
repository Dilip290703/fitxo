"use client";

import { useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CartItem } from "@/components/cart/CartItem";
import { CartDeliveryInfo } from "@/components/cart/DeliveryInfo";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { CouponCard } from "@/components/cart/CouponCard";
import { PriceSummary } from "@/components/cart/PriceSummary";
import { RecommendedProducts } from "@/components/cart/RecommendedProducts";
import { useCart } from "@/components/cart/CartProvider";
import { PincodeModal } from "@/components/PincodeModal";
import { PINCODE_STORAGE_KEY, catalogProducts, products } from "@/lib/mockData";

export function BagPageView() {
  const { items, subtotal } = useCart();
  const [couponApplied, setCouponApplied] = useState(false);
  const [pincode, setPincode] = useState("411021");
  const [isPincodeOpen, setIsPincodeOpen] = useState(false);

  useEffect(() => {
    const storedPincode = window.localStorage.getItem(PINCODE_STORAGE_KEY);
    if (storedPincode) {
      setPincode(storedPincode);
    }
  }, []);

  const recommendedProducts = useMemo(() => {
    const source = [...catalogProducts, ...products];
    return source.slice(2, 8).map((product) => ({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      oldPrice:
        "oldPrice" in product && typeof product.oldPrice === "number"
          ? product.oldPrice
          : product.price * 1.12,
    }));
  }, []);

  const discount = couponApplied ? 300 : 0;
  const finalTotal = Math.max(0, subtotal - discount);

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
              Everything you want to try at home.
            </h1>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[28px] border border-[#ece4da] bg-white px-6 py-14 text-center">
              <h2 className="font-display text-[34px] leading-none text-[#171717]">
                Your bag is empty.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[#5f5851]">
                Add a few looks and compare them at home before deciding what to keep.
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
                    Instant returns at the doorstep, zero pressure to keep anything that doesn&apos;t fit, and 60-minute availability from nearby stores.
                  </p>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-[22px] border border-[#ece4da] bg-white px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
                        Delivering to
                      </p>
                      <p className="mt-2 text-[15px] font-medium leading-6 text-[#171717]">
                        Dilip, {pincode}
                      </p>
                      <p className="mt-1 text-[13px] text-[#5f5851]">
                        FitZo partner pickup and doorstep try-on available nearby.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPincodeOpen(true)}
                      className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#171717] transition duration-200 hover:text-black"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <CouponCard
                  applied={couponApplied}
                  onToggle={() => setCouponApplied((current) => !current)}
                />

                <CartDeliveryInfo />

                <PriceSummary subtotal={subtotal} discount={discount} />

                <CheckoutButton label="Proceed to Checkout" />
              </aside>
            </div>
          )}
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8 xl:px-10">
          <RecommendedProducts
            title="Worth Adding"
            products={recommendedProducts}
            layout="carousel"
          />
        </section>

        <Footer />
      </main>

      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8dfd5] bg-[#fbfaf7]/95 px-4 py-3 backdrop-blur sm:hidden">
          <div className="mb-2 flex items-center justify-between text-[13px] text-[#5f5851]">
            <span>Grand Total</span>
            <span className="font-semibold text-[#171717]">₹{Math.round(finalTotal)}</span>
          </div>
          <CheckoutButton label="Proceed to Checkout" />
        </div>
      ) : null}

      <PincodeModal
        isOpen={isPincodeOpen}
        onClose={() => setIsPincodeOpen(false)}
        onSave={(value) => {
          window.localStorage.setItem(PINCODE_STORAGE_KEY, value);
          setPincode(value);
        }}
        currentValue={pincode}
      />
    </>
  );
}
