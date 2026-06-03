const highlights = [
  { label: "60 min", text: "Average delivery window" },
  { label: "Pay later", text: "Only for what you keep" },
  { label: "Nearby", text: "Live inventory from local stores" },
];

export function TrustStrip() {
  return (
    <section className="border-y border-[#ece4d9] bg-[#fbf7f1] py-5">
      <div className="section-frame grid gap-3 sm:grid-cols-3">
        {highlights.map((item) => (
          <article
            key={item.label}
            className="rounded-[18px] border border-[#eadfd2] bg-white/90 px-5 py-4 text-center"
          >
            <p className="font-display text-[30px] leading-none font-medium tracking-[-0.03em] text-black">
              {item.label}
            </p>
            <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#766f67]">
              {item.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
