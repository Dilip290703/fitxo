const storyPoints = [
  {
    title: "The problem",
    text: "Online fashion asks you to decide too early. Wrong fits, uncertain sizing, and too much guesswork make great clothes feel risky.",
  },
  {
    title: "The solution",
    text: "FitZo brings the fitting room home. You order pieces nearby, try them in your own space, and keep only what actually works.",
  },
  {
    title: "The vision",
    text: "We want fashion to feel instant, personal, and effortless, with less pressure and a lot more confidence.",
  },
];

export function StorySection() {
  return (
    <section className="bg-white py-20">
      <div className="section-frame grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="fade-up max-w-[520px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8b7b69]">
            Our story
          </p>
          <h2 className="mt-5 font-display text-[40px] leading-[0.96] font-medium tracking-[-0.04em] text-[#171717] sm:text-[54px]">
            Made for people who want style without the second-guessing.
          </h2>

          <div className="mt-10 space-y-7">
            {storyPoints.map((item, index) => (
              <div
                key={item.title}
                className={`fade-up ${index === 1 ? "fade-delay-1" : index === 2 ? "fade-delay-2" : ""}`}
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8b7b69]">
                  {item.title}
                </p>
                <p className="mt-3 text-[15px] leading-8 text-[#5e5852]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="fade-up fade-delay-2">
          <div className="overflow-hidden rounded-[28px] bg-[#f4ede4] shadow-[0_24px_60px_rgba(27,22,18,0.08)]">
            <img
              src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1400&q=80"
              alt="FitZo lifestyle fashion"
              className="h-[520px] w-full scale-x-[-1] object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
