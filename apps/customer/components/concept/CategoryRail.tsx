import Image from "next/image";
import Link from "next/link";

/**
 * Auto-scrolling circular category rail (ARLUNE reference). The track holds
 * the list twice and slides -50% forever; hover pauses. Pure CSS (cx-rail).
 */
export type RailItem = { label: string; image: string };

export function CategoryRail({ items }: { items: RailItem[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <section className="border-b border-[#eee] py-7">
      <div className="cx-noscroll overflow-hidden">
        <div className="cx-rail flex w-max items-start gap-8 px-6">
          {loop.map((item, i) => (
            <Link
              key={`${item.label}-${i}`}
              href="/products"
              className="group flex w-[104px] shrink-0 flex-col items-center gap-2.5"
            >
              <span className="relative h-[104px] w-[104px] overflow-hidden rounded-full ring-1 ring-[#1a1a1a] transition duration-300 group-hover:ring-2 group-hover:ring-[#b0703f]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.label}
                    fill
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
                    sizes="104px"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-[#f0eeeb] text-[11px] text-[#999]">{item.label}</span>
                )}
              </span>
              <span className="text-[14px] text-[#1a1a1a] transition group-hover:text-[#b0703f]">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
