const items = [
  {
    title: "Try Before You Buy",
    text: "Make the decision after the mirror moment, not before it.",
  },
  {
    title: "60-Minute Delivery",
    text: "Fashion moves fast, and your order should too.",
  },
  {
    title: "Instant Returns",
    text: "Pass back what you skip at the doorstep, right away.",
  },
  {
    title: "Style Personalization",
    text: "Get sharper picks based on your fit, taste, and routine.",
  },
];

export function Features() {
  return (
    <section className="bg-[#f8f6f3] py-20">
      <div className="section-frame">
        <div className="mx-auto max-w-[640px] text-center fade-up">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8b7b69]">
            What makes FitZo different
          </p>
          <h2 className="mt-4 font-display text-[38px] leading-[0.98] font-medium tracking-[-0.04em] text-[#181818] sm:text-[52px]">
            Built around ease, not compromise.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => (
            <article
              key={item.title}
              className={`fade-up rounded-[22px] border border-[#eadfd4] bg-white px-6 py-7 shadow-[0_18px_40px_rgba(30,24,19,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(30,24,19,0.1)] ${
                index === 1
                  ? "fade-delay-1"
                  : index === 2
                    ? "fade-delay-2"
                    : index === 3
                      ? "fade-delay-3"
                      : ""
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f6c9a8] text-[14px] font-extrabold text-[#1c1c1c]">
                0{index + 1}
              </div>
              <h3 className="mt-6 font-display text-[28px] leading-none font-medium tracking-[-0.03em] text-[#191919]">
                {item.title}
              </h3>
              <p className="mt-4 text-[14px] leading-7 text-[#5d5852]">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
