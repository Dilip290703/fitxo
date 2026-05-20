import { ProductOffer } from "@/components/product/types";

function TagIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#d87e65]">
      <path
        d="m10 3 9 9-7 7-9-9V3h7zm4 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-[#76716a]">
      <path
        d="M9 9h10v10H9zM5 5h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OfferCards({ offers }: { offers: ProductOffer[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {offers.map((offer) => (
        <article
          key={offer.code}
          className="flex items-start justify-between gap-4 rounded-[16px] bg-[#f4ede4] px-5 py-4"
        >
          <div className="flex gap-3">
            <TagIcon />
            <div>
              <p className="text-[14px] font-semibold text-[#171717]">
                {offer.code}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[#5a544e]">
                {offer.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mt-1 rounded-full p-1 transition duration-200 hover:bg-white/80"
            aria-label={`Copy ${offer.code}`}
          >
            <CopyIcon />
          </button>
        </article>
      ))}
    </div>
  );
}
