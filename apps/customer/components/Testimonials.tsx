import Image from "next/image";
import Link from "next/link";
import { testimonials } from "@/lib/mockData";
import { Reveal } from "@/components/motion";

/** 5-star row with half-star support; shows the numeric value beside it. */
function StarRow({ rating }: { rating: number }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <span className="flex text-[15px] leading-none text-[#a48d78]" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => {
          const fill =
            rating >= index + 1 ? 1 : rating >= index + 0.5 ? 0.5 : 0;
          return (
            <span key={index} className="relative inline-block">
              <span className="text-[#e6dac8]">★</span>
              {fill > 0 ? (
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  ★
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      <span className="text-[12px] font-medium text-[#8a7a67]">
        {rating.toFixed(1)}
      </span>
      <span className="sr-only">{rating} out of 5 stars</span>
    </div>
  );
}

function TestimonialCard({
  item,
}: {
  item: (typeof testimonials)[number];
}) {
  return (
    <Link
      href="/reviews"
      className="group w-[300px] shrink-0 rounded-[20px] border border-[#e6dac8] bg-white px-7 py-8 text-center shadow-[0_10px_30px_-18px_rgba(34,27,19,0.2)] transition duration-300 hover:-translate-y-1.5 hover:border-[#cbb9a4] hover:shadow-[0_0_0_1px_rgba(164,141,120,0.35),0_30px_60px_-24px_rgba(164,141,120,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/40 sm:w-[340px]"
    >
      <span
        aria-hidden="true"
        className="font-display text-[40px] leading-none text-[#a48d78] transition duration-300 group-hover:scale-110"
      >
        &ldquo;
      </span>
      <p className="mt-2 text-[13.5px] leading-[1.75] text-[#2c241b]">
        {item.quote}
      </p>

      <span
        aria-hidden="true"
        className="mx-auto mt-5 block h-px w-8 bg-[#cbb9a4] transition-all duration-300 group-hover:w-14 group-hover:bg-[#a48d78]"
      />

      <div className="mt-5 flex flex-col items-center">
        <span className="relative h-12 w-12 overflow-hidden rounded-full ring-1 ring-[#e6dac8]">
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        </span>
        <p className="mt-3 text-[14px] font-semibold text-[#221b13]">
          {item.name}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[#8a7a67]">
          {item.role}
        </p>
        <StarRow rating={item.rating} />
      </div>
    </Link>
  );
}

/**
 * Auto-scrolling testimonial belt: the track holds the list twice and the
 * `marquee-track` animation slides it -50% on loop (see globals.css).
 * Hovering a card pauses the belt and lifts the card with a sandstone glow.
 */
export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="relative isolate overflow-hidden bg-[#faf9f6] py-20"
    >
      <div className="section-frame">
        <Reveal className="mb-14 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a48d78]">
            Feedback
          </p>
          <h2 className="underlined-title mt-3 font-display text-[36px] font-medium tracking-[-0.03em] text-[#221b13] sm:text-[48px]">
            What Our Customers Say
          </h2>
        </Reveal>
      </div>

      {/* Full-bleed belt with feathered edges so cards melt in and out. */}
      <div
        className="relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="marquee-track flex w-max gap-6 px-3 py-4">
          {testimonials.map((item) => (
            <TestimonialCard key={item.id} item={item} />
          ))}
          {/* Second copy makes the -50% loop seamless. */}
          <div aria-hidden="true" className="contents">
            {testimonials.map((item) => (
              <TestimonialCard key={`${item.id}-loop`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
