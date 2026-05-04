export function ExperiencePreview() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="section-frame">
        <div className="group relative h-[300px] w-full overflow-hidden rounded-2xl sm:h-[420px]">
          <img
            src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1500&q=80"
            alt="Summer collection"
            className="absolute inset-0 h-full w-full scale-x-[-1] object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#8fb3d1] via-[#8fb3d1]/60 to-transparent" />

          <div className="absolute left-6 top-1/2 -translate-y-1/2 space-y-6 sm:left-16">
            <div className="leading-tight">
              <p className="font-display text-2xl text-[#1f3a5f] sm:text-4xl">
                Summer
              </p>
              <p className="font-display text-3xl text-[#e74c3c] sm:text-5xl">
                Collections
              </p>
            </div>

            <a
              href="#featured-stores"
              className="inline-flex items-center rounded-sm bg-white px-6 py-3 text-xs tracking-widest text-black transition duration-300 hover:bg-[#f4f4f4]"
            >
              <span>SHOP NOW</span>
              <span className="ml-3">→</span>
            </a>
          </div>

          <div className="absolute bottom-6 left-6 flex gap-6 sm:left-16 sm:gap-10">
            {[
              { value: "07", label: "Days" },
              { value: "08", label: "Hours" },
              { value: "04", label: "Minutes" },
              { value: "05", label: "Seconds" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-lg font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-xs text-gray-200">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
