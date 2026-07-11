import { CxReveal } from "@/components/concept/CxReveal";

/**
 * Full-bleed lifestyle band (ARLUNE "Fantastical Friends"). Plays a muted,
 * looping background video from public/concept/band.mp4 with the still image
 * as poster/fallback — so it looks right before the clip is added.
 */
export function FantasticalBand({ image }: { image: string }) {
  return (
    <section className="relative my-4 h-[440px] w-full overflow-hidden sm:h-[560px]">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        poster={image || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
      >
        <source src="/concept/band.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/35" />
      <CxReveal className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
        <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-white/85">New Collection</p>
        <h2 className="mt-4 font-sans text-[clamp(2.6rem,6vw,5rem)] font-black uppercase leading-[0.95]">
          Fantastical<br />Friends
        </h2>
        <p className="mt-5 max-w-[460px] text-[15px] text-white/85">
          We love seeing how you style your Fitzo picks — tag us and get featured.
        </p>
        <button className="mt-8 inline-flex h-12 items-center border border-white/70 px-9 text-[12px] font-semibold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#1a1a1a]">
          Shop now
        </button>
      </CxReveal>
    </section>
  );
}
