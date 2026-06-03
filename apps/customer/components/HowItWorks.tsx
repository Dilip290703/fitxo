const steps = [
  {
    step: "01",
    title: "Choose your city look",
    description:
      "Browse curated styles from stores near you, with live stock and size availability.",
  },
  {
    step: "02",
    title: "Get it in 60 minutes",
    description:
      "A FitZo delivery partner brings multiple picks to your doorstep for an at-home try-on.",
  },
  {
    step: "03",
    title: "Keep what feels right",
    description:
      "Pay only for the pieces you love and hand back the rest instantly, right there.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-20">
      <div className="section-frame">
        <div className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-[38px] font-medium tracking-[-0.03em] text-black sm:text-[48px]">
            How FitZo works
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-[#67615a]">
            Fashion convenience built around your schedule, your neighborhood,
            and your fit preferences.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((item) => (
            <article
              key={item.step}
              className="card-shadow rounded-[22px] border border-[#ece5db] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe4_100%)] px-7 py-8 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_rgba(24,24,28,0.12)]"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-[#b6903e]">
                Step {item.step}
              </p>
              <h3 className="mt-4 font-display text-[32px] leading-none font-medium tracking-[-0.03em] text-black">
                {item.title}
              </h3>
              <p className="mt-4 text-[14px] leading-7 text-[#625b54]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
