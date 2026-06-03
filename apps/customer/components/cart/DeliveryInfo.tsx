"use client";

import { useLocation } from "@/store/locationStore";

function BoltIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#c76b4d]">
      <path
        d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Compact delivery status strip used in the AddToBagDrawer, BagPage sidebar,
 * and CheckoutPage. Reflects the real pincode serviceability from locationStore.
 */
export function CartDeliveryInfo() {
  const { deliveryStatus, hasChecked } = useLocation();

  // No pincode saved yet — show neutral prompt
  if (!hasChecked) {
    return (
      <div className="flex items-start gap-3 rounded-[18px] bg-[#f4ede4] px-4 py-4">
        <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">
          <BoltIcon />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#171717]">
            60-Minute Delivery
          </p>
          <p className="mt-1 text-[13px] text-[#5d5750]">
            Try at home before paying
          </p>
          <p className="mt-1 text-[12px] text-[#726b63]">
            Enter your pincode to check availability
          </p>
        </div>
      </div>
    );
  }

  // Pincode checked — show real availability
  if (deliveryStatus.available) {
    return (
      <div className="flex items-start gap-3 rounded-[18px] bg-[#e8f5e9] px-4 py-4">
        <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">
          <BoltIcon />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#2e7d32]">
            60-Minute Delivery Available ✓
          </p>
          <p className="mt-1 text-[13px] text-[#388e3c]">
            Try at home before paying
          </p>
          <p className="mt-1 text-[12px] text-[#4caf50]">
            Doorstep try-on from nearby Pune stores
          </p>
        </div>
      </div>
    );
  }

  // Pincode checked but unavailable
  return (
    <div className="flex items-start gap-3 rounded-[18px] bg-[#fdecea] px-4 py-4">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80">
        <span className="text-[16px] leading-none text-[#c0392b]">✗</span>
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#c0392b]">
          Delivery unavailable
        </p>
        <p className="mt-1 text-[13px] text-[#c0392b]/80">
          FitZo is currently available only in Pune.
        </p>
      </div>
    </div>
  );
}
