const valueProps = [
  {
    title: "Personalized recommendations",
    text: "FitZo learns your sizing preferences and surfaces quick-pick looks from stores nearby.",
  },
  {
    title: "Live order tracking",
    text: "Track your stylist courier in real time and coordinate instant exchanges without leaving home.",
  },
  {
    title: "Instant returns",
    text: "Hand back what you skip right at the door, with payment updated on the spot.",
  },
];

export function ValueProposition() {
  return (
    <section id="why-fitzo" className="bg-[#fcfbf8] py-16 sm:py-20">
      <div className="section-frame">
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="font-display text-[38px] font-medium tracking-[-0.03em] text-black sm:text-[48px]">
            Why FitZo
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-[#66605a]">
            Designed for same-day fashion decisions without the stress of buying blind.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {valueProps.map((item) => (
            <article
              key={item.title}
              className="card-shadow rounded-[20px] border border-[#efe8df] bg-white px-7 py-8 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_rgba(24,24,28,0.12)]"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#8b7a68]">
                Why FitZo
              </p>
              <h3 className="mt-3 font-display text-[30px] leading-none font-medium tracking-[-0.03em] text-black">
                {item.title}
              </h3>
              <p className="mt-4 text-[14px] leading-7 text-[#64615b]">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
