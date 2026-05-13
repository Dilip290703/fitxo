import Link from "next/link";

const topLinks = [
  { label: "Home", href: "/" },
  { label: "Categories", href: "/#featured-stores" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Sale", href: "/#featured-stores" },
];
const categoryLinks = ["Men", "Women", "Kids", "Home", "Collections"];

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M12.1 20.3l-.1.1-.11-.1C7 15.9 4 13.17 4 9.8 4 7.03 6.02 5 8.6 5c1.46 0 2.86.67 3.78 1.72C13.3 5.67 14.7 5 16.16 5 18.74 5 20.76 7.03 20.76 9.8c0 3.37-3 6.1-8.66 10.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M20 21a8 8 0 10-16 0m8-9a4.5 4.5 0 100-9 4.5 4.5 0 000 9z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12 21s6-5.7 6-11a6 6 0 10-12 0c0 5.3 6 11 6 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3 w-3 opacity-60"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function Navbar() {
  return (
    <header id="top" className="border-b border-gray-200 bg-[#f8f6f3]">
      <div className="relative border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 md:px-10 lg:px-12">
          <nav className="hidden items-center gap-8 text-xs uppercase tracking-widest text-gray-600 md:flex">
            {topLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group relative inline-block pb-2 transition-colors duration-200 hover:text-black"
              >
                <span>{item.label}</span>

                <span className="pointer-events-none absolute bottom-0 left-0 h-[1.5px] w-full scale-x-0 bg-black opacity-0 origin-left transition-all duration-300 ease-out group-hover:scale-x-100 group-hover:opacity-100 group-hover:origin-left group-[&:not(:hover)]:origin-right" />
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d2c8] text-[#3a3a3a] md:hidden"
            aria-label="Open menu"
          >
            <span className="block h-px w-4 bg-current shadow-[0_5px_0_0_currentColor,0_-5px_0_0_currentColor]" />
          </button>

          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 font-serif text-xl font-medium tracking-[0.3em] text-gray-800 transition duration-200 hover:text-black"
          >
            FITZO
          </Link>

          <div className="ml-auto flex items-center gap-5 text-gray-700">
            <div className="hidden items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 md:flex">
              <PinIcon />
              <span>Enter Pincode</span>
              <ChevronDown />
            </div>

            <button
              type="button"
              className="transition duration-200 hover:text-black"
              aria-label="Search"
            >
              <SearchIcon />
            </button>

            <button
              type="button"
              className="hidden transition duration-200 hover:text-black md:block"
              aria-label="Wishlist"
            >
              <HeartIcon />
            </button>

            <button
              type="button"
              className="transition duration-200 hover:text-black"
              aria-label="Account"
            >
              <UserIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-2 md:px-10 lg:px-12">
        <div className="flex items-center justify-center overflow-x-auto hide-scrollbar">
          <nav className="flex min-w-max items-center gap-8 text-sm text-gray-600">
            {categoryLinks.map((item) => (
              <a
                key={item}
                href="#"
                className="flex items-center gap-2 transition duration-200 hover:text-black"
              >
                <span>{item}</span>
                <ChevronDown />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
