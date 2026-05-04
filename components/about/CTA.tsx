export function AboutCTA() {
  return (
    <section className="bg-white py-20">
      <div className="section-frame">
        <div className="rounded-[30px] border border-[#eadfd4] bg-[linear-gradient(135deg,#fffdf8_0%,#f9efe3_55%,#f6c7a4_100%)] px-6 py-10 text-center shadow-[0_26px_60px_rgba(33,26,20,0.08)] md:px-10 md:py-14">
          <p className="fade-up text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8b7b69]">
            Ready when you are
          </p>
          <h2 className="fade-up fade-delay-1 mt-5 font-display text-[40px] leading-[0.94] font-medium tracking-[-0.05em] text-[#171717] sm:text-[56px]">
            Start trying at home today.
          </h2>
          <a
            href="/#featured-stores"
            className="fade-up fade-delay-2 button-shadow mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[color:var(--accent)] px-7 text-[11px] font-extrabold uppercase tracking-[0.26em] text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-95"
          >
            Explore FitZo
          </a>
        </div>
      </div>
    </section>
  );
}
