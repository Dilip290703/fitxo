"use client";

import { useState } from "react";
import { getDeliveryStatus } from "@/lib/pincode";
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M5 12l5 5L20 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function DeliveryInfo() {
  const { selectedPincode, setPincode, deliveryStatus, hasChecked } = useLocation();

  // Local input field — pre-filled with saved pincode
  const [input, setInput] = useState(selectedPincode);
  // Live preview while typing (before clicking Check)
  const liveStatus = /^\d{6}$/.test(input.trim())
    ? getDeliveryStatus(input.trim())
    : null;

  const handleCheck = () => {
    const clean = input.trim();
    if (/^\d{6}$/.test(clean)) {
      setPincode(clean); // persist globally
    }
  };

  // What to display in the status area
  const displayStatus = (() => {
    // User has typed 6 digits → show live preview immediately
    if (liveStatus) return liveStatus;
    // Fallback: show stored pincode's status
    if (hasChecked) return deliveryStatus;
    return null;
  })();

  return (
    <div className="space-y-4 rounded-[22px] bg-[#f4ede4] px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
          <BoltIcon />
        </div>
        <div>
          <p className="text-[18px] font-medium text-[#171717]">
            60-Minute Delivery
          </p>
          <p className="mt-2 text-[13px] font-medium text-[#5d5750]">
            Try at home before you pay
          </p>
          <p className="mt-2 text-[13px] leading-6 text-[#615a53]">
            Available across Pune partner stores.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          placeholder="Enter pincode"
          className="h-12 flex-1 rounded-[14px] border border-[#ddd3c7] bg-[#fbfaf7] px-4 text-[14px] outline-none transition duration-200 focus:border-[#171d2b]"
        />
        <button
          type="button"
          onClick={handleCheck}
          className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#171d2b] px-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition duration-200 hover:bg-[#0f1522]"
        >
          Check
        </button>
      </div>

      {/* Status feedback */}
      {displayStatus ? (
        <div
          className={`flex items-start gap-2 rounded-[12px] px-4 py-3 text-[13px] font-medium ${
            displayStatus.available
              ? "bg-[#e8f5e9] text-[#2e7d32]"
              : "bg-[#fdecea] text-[#c0392b]"
          }`}
        >
          {displayStatus.available ? (
            <span className="mt-0.5 shrink-0"><CheckIcon /></span>
          ) : (
            <span className="shrink-0 text-[15px] leading-none">✗</span>
          )}
          <span>{displayStatus.message}</span>
        </div>
      ) : (
        <p className="text-[13px] leading-6 text-[#5d5750]">
          Enter your pincode to check 60-min delivery availability.
        </p>
      )}
    </div>
  );
}
