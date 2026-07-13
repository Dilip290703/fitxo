import { NearbyStore } from "@/components/product/types";

/**
 * The partner store(s) that fulfil this product. Distances/ETAs render only
 * if they ever exist — the DB has no geo data, so we don't invent any.
 */
export function NearbyStores({ stores }: { stores: NearbyStore[] }) {
  if (stores.length === 0) return null;

  return (
    <section className="rounded-[22px] bg-[#f4ede4] p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
        Fulfilled by
      </p>
      <p className="mt-3 text-[15px] leading-7 text-[#3d3731]">
        Your try-on picks are prepared and packed by this partner store, then
        brought to your door by a Fitzo rider.
      </p>

      <div className="mt-5 space-y-3">
        {stores.map((store) => (
          <div
            key={store.name}
            className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4ede4] text-[15px]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#8b7058]" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M9 19v-6h6v6" />
              </svg>
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#171717]">
                {store.name}
              </p>
              {store.distance && store.eta ? (
                <p className="mt-1 text-[13px] text-[#6c655e]">
                  {store.distance} away · ETA {store.eta}
                </p>
              ) : (
                <p className="mt-1 text-[13px] text-[#6c655e]">
                  Fitzo partner store · Pune
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
