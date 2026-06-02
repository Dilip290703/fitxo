"use client";

export function WishlistToast({ message }: { message: string }) {
  return (
    <div
      className={`fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 transition duration-300 ${
        message ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="rounded-full border border-[#e5dbd0] bg-white px-5 py-3 text-[13px] font-medium text-[#171717] shadow-[0_18px_40px_rgba(26,22,18,0.12)]">
        {message}
      </div>
    </div>
  );
}
