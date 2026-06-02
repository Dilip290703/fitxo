import Link from "next/link";

export function EmptyWishlist() {
  return (
    <div className="rounded-[30px] border border-[#ece4da] bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f4ede4] text-[34px] text-[#171717]">
        ♡
      </div>
      <h2 className="mt-6 font-display text-[40px] leading-none text-[#171717]">
        Your wishlist is empty
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[#5f5851]">
        Save styles you love and shop them later.
      </p>
      <Link
        href="/products"
        className="mt-8 inline-flex rounded-[16px] bg-black px-7 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] !text-white visited:!text-white hover:!text-white transition duration-300 hover:opacity-90"
      >
        Explore Products
      </Link>
    </div>
  );
}
