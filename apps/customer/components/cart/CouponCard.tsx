"use client";

type CouponCardProps = {
  applied: boolean;
  onToggle: () => void;
};

export function CouponCard({ applied, onToggle }: CouponCardProps) {
  return (
    <div className="rounded-[22px] border border-[#ece4da] bg-white px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] text-[#3a3631]">
            Save <span className="font-semibold">₹300</span> with{" "}
            <span className="font-semibold">FITZO10</span>
          </p>
          <p className="mt-2 text-[13px] text-[#c76b4d]">
            View coupons and gift cards
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-[14px] font-semibold uppercase tracking-[0.06em] text-[#171717] transition duration-200 hover:text-black"
        >
          {applied ? "Applied" : "Apply"}
        </button>
      </div>
    </div>
  );
}
