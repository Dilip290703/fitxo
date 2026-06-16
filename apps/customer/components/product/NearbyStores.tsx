import { NearbyStore } from "@/components/product/types";

export function NearbyStores({ stores }: { stores: NearbyStore[] }) {
  return (
    <section className="rounded-[22px] bg-[#f4ede4] p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
        Available nearby
      </p>
      <p className="mt-3 text-[15px] leading-7 text-[#3d3731]">
        Try on at your door before paying, or visit the closest partner store right away.
      </p>

      <div className="mt-5 space-y-3">
        {stores.map((store) => (
          <div
            key={store.name}
            className="flex flex-col gap-3 rounded-[18px] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-[14px] font-semibold text-[#171717]">
                {store.name}
              </p>
              <p className="mt-1 text-[13px] text-[#6c655e]">
                {store.distance} away · ETA {store.eta}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-[12px] bg-black px-5 py-3 text-[12px] font-medium text-white transition duration-200 hover:bg-[#1f1f1f]"
            >
              Visit Now
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
