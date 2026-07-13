/** Tan scrolling promo strip (ARLUNE reference). Pure CSS marquee. */
const MESSAGES = [
  "Try before you buy — rider waits at your door",
  "Keep only what fits",
  "60-minute delivery from stores near you",
  "Hand returns straight back — no pickup to schedule",
];

export function PromoMarquee() {
  const loop = [...MESSAGES, ...MESSAGES];
  return (
    <div className="overflow-hidden bg-[#b0703f] py-3.5 text-white">
      <div className="cx-marquee flex w-max items-center gap-14 whitespace-nowrap pr-14">
        {loop.map((m, i) => (
          <span key={i} className="flex items-center gap-14 text-[15px] tracking-wide">
            {m}
            <span aria-hidden className="text-white/50">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
