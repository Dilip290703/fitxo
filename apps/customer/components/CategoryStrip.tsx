import Image from "next/image";
import Link from "next/link";
import { createClient } from "@fitzo/supabase/server";

/**
 * Round category chips under the hero (reference: Women / Men / … / Sale).
 * Chips come from the genders that actually exist in the categories table,
 * so a chip can never point at an empty catalogue bucket. Sale is the one
 * fixed chip and uses the real `/products?sale=true` filter.
 */

const GENDER_ORDER = ["women", "men", "kids"];

const GENDER_META: Record<string, { label: string; image: string }> = {
  women: {
    label: "Women",
    image:
      "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=400&q=80",
  },
  men: {
    label: "Men",
    image:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=400&q=80",
  },
  kids: {
    label: "Kids",
    image:
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=400&q=80",
  },
};

export async function CategoryStrip() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("gender")
    .eq("is_active", true);

  const genders = GENDER_ORDER.filter((gender) =>
    (data ?? []).some((row: { gender: string | null }) => row.gender === gender),
  );

  if (genders.length === 0) return null;

  return (
    <section className="border-b border-[#e6dac8] bg-white">
      <div className="section-frame py-9 sm:py-10">
        <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-6 sm:gap-x-16">
          {genders.map((gender) => {
            const meta = GENDER_META[gender];
            return (
              <Link
                key={gender}
                href={`/products?category=${gender}`}
                className="group flex flex-col items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/40"
              >
                <span className="relative h-20 w-20 overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-[#e6dac8] transition duration-300 group-hover:ring-2 group-hover:ring-[#a48d78] sm:h-24 sm:w-24">
                  <Image
                    src={meta.image}
                    alt={meta.label}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.08]"
                    sizes="96px"
                  />
                </span>
                <span className="text-[13px] font-medium tracking-[0.02em] text-[#221b13] transition group-hover:text-[#a48d78]">
                  {meta.label}
                </span>
              </Link>
            );
          })}

          <Link
            href="/products?sale=true"
            className="group flex flex-col items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/40"
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[#221b13] text-[13px] font-semibold uppercase tracking-[0.18em] text-[#faf9f6] transition duration-300 group-hover:bg-[#a48d78] sm:h-24 sm:w-24">
              Sale
            </span>
            <span className="text-[13px] font-medium tracking-[0.02em] text-[#221b13] transition group-hover:text-[#a48d78]">
              Sale
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
