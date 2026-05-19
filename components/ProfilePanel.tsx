"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_STORAGE_KEY, PINCODE_STORAGE_KEY } from "@/lib/mockData";
import { getStorageItem, removeStorageItem } from "@/lib/storage";

export function ProfilePanel() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pincode, setPincode] = useState("Not set");

  useEffect(() => {
    setIsLoggedIn(getStorageItem(AUTH_STORAGE_KEY) === "true");
    const storedPincode = getStorageItem(PINCODE_STORAGE_KEY);
    if (storedPincode) {
      setPincode(storedPincode);
    }
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="max-w-xl rounded-[28px] border border-[#eadfd4] bg-white p-8 shadow-[0_24px_60px_rgba(28,23,18,0.08)]">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
          Profile locked
        </p>
        <h2 className="mt-4 font-display text-[40px] leading-none text-[#171717]">
          Sign in to view saved try-ons.
        </h2>
        <p className="mt-4 text-[15px] leading-7 text-[#5f5750]">
          Your demo session is currently logged out.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition duration-200 hover:bg-[#141d2b]"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {[
        { label: "Saved pincode", value: pincode },
        { label: "Wishlist", value: "3 looks saved" },
        { label: "Next delivery slot", value: "Within 60 min" },
      ].map((item) => (
        <article
          key={item.label}
          className="rounded-[24px] border border-[#eadfd4] bg-white p-7 shadow-[0_20px_50px_rgba(28,23,18,0.06)]"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
            {item.label}
          </p>
          <p className="mt-4 font-display text-[34px] leading-none text-[#171717]">
            {item.value}
          </p>
        </article>
      ))}

      <button
        type="button"
        onClick={() => {
          removeStorageItem(AUTH_STORAGE_KEY);
          router.push("/login");
        }}
        className="inline-flex h-12 items-center justify-center rounded-full border border-[#cab6a5] px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#4b3b2e] transition duration-300 hover:bg-white/70"
      >
        Log out
      </button>
    </div>
  );
}
