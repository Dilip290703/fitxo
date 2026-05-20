"use client";

import { useState } from "react";

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

export function DeliveryInfo() {
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState(
    "Available across nearby partner stores.",
  );

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
            Available across nearby partner stores.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={pincode}
          onChange={(event) =>
            setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="Enter pincode"
          className="h-12 flex-1 rounded-[14px] border border-[#ddd3c7] bg-[#fbfaf7] px-4 text-[14px] outline-none transition duration-200 focus:border-[#171d2b]"
        />
        <button
          type="button"
          onClick={() =>
            setMessage(
              /^\d{6}$/.test(pincode)
                ? `Available for ${pincode}. 60-Minute Delivery and try-at-home access confirmed.`
                : "Enter a valid 6-digit pincode to check delivery.",
            )
          }
          className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#171d2b] px-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition duration-200 hover:bg-[#0f1522]"
        >
          Check
        </button>
      </div>

      <p className="text-[13px] leading-6 text-[#5d5750]">{message}</p>
    </div>
  );
}
