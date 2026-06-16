const steps = [
  "Pick outfits",
  "Book a delivery slot",
  "Try on while the rider waits",
  "Pay for what you keep",
];

export function HowItWorks() {
  return (
    <section className="bg-white py-20">
      <div className="section-frame">
        <div className="mx-auto max-w-[620px] text-center fade-up">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8b7b69]">
            How it works
          </p>
          <h2 className="mt-4 font-display text-[38px] leading-[0.98] font-medium tracking-[-0.04em] text-[#181818] sm:text-[52px]">
            Four steps to a more confident checkout.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`fade-up rounded-[24px] border border-[#ece4db] bg-[#fcfaf7] px-6 py-8 ${
                index === 1
                  ? "fade-delay-1"
                  : index === 2
                    ? "fade-delay-2"
                    : index === 3
                      ? "fade-delay-3"
                      : ""
              }`}
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#8b7b69]">
                Step 0{index + 1}
              </p>
              <h3 className="mt-5 font-display text-[30px] leading-none font-medium tracking-[-0.03em] text-[#171717]">
                {step}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
