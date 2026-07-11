import Image from "next/image";
import Link from "next/link";

/** "JOURNAL" — 3 editorial blog cards with date pills (ARLUNE reference). */
const POSTS = [
  {
    title: "Try-at-home, done right: our 5 fitting-room tips",
    excerpt: "The rider waits while you decide — here's how to make the most of your 60-minute window.",
    date: ["FEB", "21", "2026"],
  },
  {
    title: "T-shirts that speak your style: how to wear them right",
    excerpt: "T-shirts are the most versatile piece in your closet. But do you know how to style them?",
    date: ["FEB", "21", "2026"],
  },
  {
    title: "How to style a fancy top for every occasion",
    excerpt: "From brunch to boardroom, a well-chosen top does the heavy lifting. Here's our edit.",
    date: ["FEB", "21", "2026"],
  },
];

export function Journal({ images }: { images: string[] }) {
  return (
    <section id="journal" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <div className="cx-rise text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-[#8a8a8a]">Sub title top</p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,4vw,3rem)] font-black uppercase text-[#1a1a1a]">Journal</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] text-[#6b6b6b]">
            Subscribe for the latest news and style notes from our editors.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {POSTS.map((post, i) => (
            <article key={post.title} className="group">
              <Link href="#" className="relative block aspect-[4/5] overflow-hidden rounded-[6px] bg-[#f0eeeb]">
                {images[i] ? (
                  <Image
                    src={images[i]}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : null}
                <span className="absolute left-4 top-4 flex items-center gap-1.5 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1a1a1a]">
                  {post.date[0]} <span className="text-[#b0703f]">{post.date[1]}</span> {post.date[2]}
                </span>
              </Link>
              <h3 className="mt-5 text-[22px] font-medium leading-snug text-[#1a1a1a] transition group-hover:text-[#b0703f]">
                {post.title}
              </h3>
              <p className="mt-3 border-t border-[#eee] pt-4 text-[14px] leading-6 text-[#6b6b6b]">
                {post.excerpt}
              </p>
              <Link
                href="#"
                className="mt-5 inline-flex h-10 items-center bg-[#b0703f] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#98602f]"
              >
                More details
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
