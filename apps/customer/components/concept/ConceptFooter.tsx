import Link from "next/link";

/** ARLUNE-style footer, FITZO content. Dark, columned, with newsletter. */
const COLS = [
  { title: "Shop", items: ["New Arrivals", "Men", "Women", "Collections", "Sale"] },
  { title: "Company", items: ["About Fitzo", "How it works", "Stores near you", "Careers"] },
  { title: "Support", items: ["Track order", "Try-at-home", "Returns", "Contact us"] },
];

export function ConceptFooter() {
  return (
    <footer className="bg-[#1a1a1a] text-[#e6e2dc]">
      <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="font-sans text-[26px] font-bold tracking-[0.28em] text-white">FITZO</p>
            <p className="mt-5 max-w-[300px] text-[14px] leading-7 text-white/60">
              Fashion delivered in 60 minutes. Try it on at your door while the
              rider waits — keep only what fits.
            </p>
            <form className="mt-6 flex max-w-[340px]">
              <input
                type="email"
                placeholder="Your email"
                className="h-12 min-w-0 flex-1 border border-white/25 bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-white"
              />
              <button className="h-12 bg-[#b0703f] px-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#98602f]">
                Join
              </button>
            </form>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white">{col.title}</h4>
              <ul className="mt-5 space-y-3 text-[14px] text-white/60">
                {col.items.map((it) => (
                  <li key={it}><Link href="/products" className="transition hover:text-white">{it}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-[13px] text-white/50 sm:flex-row">
          <p>©2026 Fitzo — concept preview. Not the live store.</p>
          <div className="flex gap-6">
            <Link href="#" className="transition hover:text-white">Privacy</Link>
            <Link href="#" className="transition hover:text-white">Terms</Link>
            <Link href="/" className="transition hover:text-white">← Back to live site</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
