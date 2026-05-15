"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_STORAGE_KEY } from "@/lib/mockData";

export function LoginPanel() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoLogin = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setIsLoading(false);
    router.push("/profile");
  };

  return (
    <div className="max-w-md rounded-[28px] border border-[#eadfd4] bg-white p-8 shadow-[0_24px_60px_rgba(28,23,18,0.08)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
        Mock auth
      </p>
      <h2 className="mt-4 font-display text-[40px] leading-none text-[#171717]">
        Sign in to keep your picks synced.
      </h2>
      <p className="mt-4 text-[15px] leading-7 text-[#5f5750]">
        This demo uses local browser state, so the profile flow works without a backend.
      </p>
      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={isLoading}
        className="mt-8 inline-flex h-12 items-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition duration-200 hover:bg-[#141d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Signing in..." : "Continue as demo user"}
      </button>
    </div>
  );
}
