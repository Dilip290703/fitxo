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

export function CartDeliveryInfo() {
  return (
    <div className="flex items-start gap-3 rounded-[18px] bg-[#f4ede4] px-4 py-4">
      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">
        <BoltIcon />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#171717]">
          60-Minute Delivery Available
        </p>
        <p className="mt-1 text-[13px] text-[#5d5750]">
          Try at home before paying
        </p>
        <p className="mt-1 text-[12px] text-[#726b63]">
          Available across nearby partner stores
        </p>
      </div>
    </div>
  );
}
