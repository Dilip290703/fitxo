"use client";

import { useRef } from "react";
import { ExperiencePreview } from "@/components/ExperiencePreview";

const stores = [
  {
    name: "Bewakoof",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/bewakoof.svg",
    containerClass: "bg-yellow-400 px-6",
    logoClass:
      "h-8 max-w-[138px] object-contain transition duration-200 group-hover:scale-105 md:h-9",
  },
  {
    name: "Marks & Spencer",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/marks-spencer.svg",
    containerClass: "bg-gray-200 px-6",
    logoClass:
      "h-8 max-w-[138px] object-contain transition duration-200 group-hover:scale-105 md:h-9",
  },
  {
    name: "Raymond",
    image:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/raymond.svg",
    containerClass: "bg-transparent p-0",
    logoClass:
      "h-full w-full object-contain transition duration-200 group-hover:scale-105",
  },
  {
    name: "UCB",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/ucb.svg",
    containerClass: "bg-transparent p-0",
    logoClass:
      "h-full w-full object-contain transition duration-200 group-hover:scale-105",
  },
  {
    name: "H&M",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/hm.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-8 max-w-[138px] object-contain transition duration-200 group-hover:scale-105",
  },
  {
    name: "Zara",
    image:
      "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/zara.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[150px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
  {
    name: "Levi's",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/levis.svg",
    containerClass: "bg-red-600 px-6",
    logoClass:
      "h-7 max-w-[132px] object-contain brightness-0 invert transition duration-200 group-hover:scale-105 md:h-8",
  },
  {
    name: "Nike",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/nike.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[132px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
  {
    name: "Adidas",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/adidas.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[132px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
  {
    name: "Puma",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80",
    logo: "/brands/puma.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[132px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
];

const categories = [
  {
    title: "Kurti Dress",
    subtitle: "Be inspired",
    image:
      "https://images.unsplash.com/photo-1610030469668-4d9c3f4e14f7?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Traditional",
    subtitle: "Festive picks",
    image:
      "https://images.unsplash.com/photo-1614251056216-f748a1a8f0cd?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Street Wear",
    subtitle: "New arrivals",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Wedding Wear",
    subtitle: "Bridal edit",
    image:
      "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&w=600&q=80",
  },
];

const logos = ["CHANEL", "D&G", "Dior", "VERSACE", "ZARA", "GUCCI"];

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BrandBanner({
  name,
  logo,
  containerClass,
  logoClass,
}: {
  name: string;
  logo: string;
  containerClass: string;
  logoClass: string;
}) {
  return (
    <div
      className={`mt-4 flex h-[70px] w-full items-center justify-center overflow-hidden rounded-xl ${containerClass}`}
    >
      <img src={logo} alt={`${name} logo`} className={logoClass} />
    </div>
  );
}

export function FeaturedStores() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section id="featured-stores">
      <div className="bg-[#f8f6f3] px-10 py-20">
        <div className="mx-auto max-w-[1240px] text-center">
          <h2 className="mb-12 text-center font-serif text-3xl text-gray-900">
            Shop by brand
          </h2>

          <div className="relative">
            <button
              type="button"
              onClick={() => scrollByAmount(-300)}
              className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition duration-200 hover:shadow-md md:flex"
              aria-label="Scroll brands left"
            >
              <ArrowLeftIcon />
            </button>

            <div
              ref={scrollRef}
              className="hide-scrollbar flex gap-6 overflow-x-auto scroll-smooth px-1"
            >
              {stores.map((store) => (
                <article
                  key={store.name}
                  className="group min-w-[180px] rounded-2xl bg-white p-4 text-left shadow-sm transition duration-200 hover:shadow-md sm:min-w-[210px] lg:min-w-[240px]"
                >
                  <img
                    src={store.image}
                    alt={store.name}
                    className="h-[260px] w-full rounded-xl object-cover"
                  />
                  <BrandBanner
                    name={store.name}
                    logo={store.logo}
                    containerClass={store.containerClass}
                    logoClass={store.logoClass}
                  />
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollByAmount(300)}
              className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition duration-200 hover:shadow-md md:flex"
              aria-label="Scroll brands right"
            >
              <ArrowRightIcon />
            </button>
          </div>

          <div className="mt-12 flex justify-center">
            <a
              href="#why-fitzo"
              className="inline-flex rounded-md bg-yellow-400 px-6 py-3 text-xs uppercase tracking-widest text-black transition duration-200 hover:opacity-90"
            >
              Start trying at home
            </a>
          </div>
        </div>
      </div>

      <div className="bg-[color:var(--beige)] py-14 sm:py-16">
        <div className="section-frame">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="font-display text-[36px] font-medium tracking-[-0.02em] text-black sm:text-[48px]">
              This week&apos;s hot picks are HOT hot
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-[#63605b]">
              From festive edits to streetwear staples, browse the styles nearby
              and schedule a doorstep fitting.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((item) => (
              <article
                key={item.title}
                className="card-shadow overflow-hidden rounded-[10px] border border-[#ece6de] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(31,31,35,0.12)]"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-[250px] w-full object-cover"
                />
                <div className="px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a847c]">
                    {item.subtitle}
                  </p>
                  <h3 className="mt-1 text-[21px] font-extrabold leading-tight text-[#111111]">
                    {item.title}
                  </h3>
                  <a
                    href="#how-it-works"
                    className="mt-5 inline-flex h-9 items-center rounded-sm bg-[color:var(--soft-yellow)] px-4 text-[10px] font-extrabold uppercase tracking-[0.22em] text-black transition duration-300 hover:-translate-y-0.5 hover:brightness-95"
                  >
                    Shop now
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <ExperiencePreview />

      <div className="bg-white py-14 sm:py-16">
        <div className="section-frame text-center">
          <p className="font-display text-[24px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
            Brands for you
          </p>
          <div className="mx-auto mt-2 h-px w-16 bg-[#1c1c1c]" />

          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {logos.map((logo) => (
              <div
                key={logo}
                className="flex h-14 items-center justify-center text-center font-display text-[27px] font-semibold tracking-[-0.03em] text-black"
              >
                {logo}
              </div>
            ))}
          </div>

          <a
            href="#why-fitzo"
            className="mt-11 inline-flex h-12 items-center rounded-[6px] bg-[#cfeafb] px-8 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#16344f] shadow-[0_18px_34px_rgba(154,205,238,0.55)] transition duration-300 hover:-translate-y-0.5"
          >
            View our all stores
          </a>
        </div>
      </div>
    </section>
  );
}
