"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@fitzo/supabase/client";
import { useCart } from "@/components/cart/CartProvider";
import { PincodeModal } from "@/components/PincodeModal";
import { useWishlist } from "@/store/wishlistStore";
import { useLocation } from "@/store/locationStore";

const megaCategories = [
  {
    title: "MEN",
    href: "/products?category=men",
    links: [
      { label: "Shirts", href: "/products?category=men" },
      { label: "Streetwear", href: "/products?category=men&collection=summer" },
      { label: "Sale picks", href: "/products?sale=true&category=men" },
    ],
  },
  {
    title: "WOMEN",
    href: "/products?category=women",
    links: [
      { label: "Dresses", href: "/products?category=women" },
      { label: "Wedding wear", href: "/products?category=women&collection=summer" },
      { label: "Try-on edits", href: "/products?category=women" },
    ],
  },
  {
    title: "KIDS",
    href: "/products?category=kids",
    links: [
      { label: "Festive fits", href: "/products?category=kids" },
      { label: "Everyday styles", href: "/products?category=kids" },
      { label: "Easy returns", href: "/products?category=kids" },
    ],
  },
  {
    title: "HOME",
    href: "/products?category=home",
    links: [
      { label: "Lounge sets", href: "/products?category=home" },
      { label: "Soft essentials", href: "/products?category=home" },
      { label: "Nearby delivery", href: "/products?category=home" },
    ],
  },
  {
    title: "ACCESSORIES",
    href: "/products?category=accessories",
    links: [
      { label: "Weekend add-ons", href: "/products?category=accessories" },
      { label: "Event-ready extras", href: "/products?category=accessories" },
      { label: "Trending now", href: "/products?category=accessories" },
    ],
  },
];

const topLinks = [
  { label: "HOME", href: "/" },
  { label: "PRODUCTS", href: "/products" },
  { label: "CATEGORIES", href: "/products", isTrigger: true },
  { label: "ABOUT US", href: "/about" },
  { label: "SALE", href: "/products?sale=true" },
];

const categoryLinks = [
  { label: "MEN", href: "/products?category=men" },
  { label: "WOMEN", href: "/products?category=women" },
  { label: "KIDS", href: "/products?category=kids" },
  { label: "HOME", href: "/products?category=home" },
  { label: "COLLECTIONS", href: "/products?collection=summer" },
];

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

function BagIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M6 9h12l-1 10H7L6 9zm3-1V7a3 3 0 116 0v1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-3 w-3 opacity-60 ${className}`}
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

/** Check whether the current pathname matches a given nav href */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Strip query string for matching
  const basePath = href.split("?")[0];
  return pathname.startsWith(basePath);
}

function NavIconButton({
  label,
  active,
  onClick,
  children,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-[#1f2a3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd233]/70 ${
        active ? "text-[#1f2a3c]" : "text-[#6f6860]"
      }`}
      aria-label={label}
    >
      <span className="transition duration-200 group-hover:scale-105">{children}</span>
      {typeof badge === "number" && badge > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
      <span
        className={`pointer-events-none absolute -bottom-1 left-1/2 h-[1.5px] w-5 -translate-x-1/2 rounded-full bg-[#1f2a3c] transition duration-200 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-45"
        }`}
      />
    </button>
  );
}

type NavbarProps = {
  showSecondaryNav?: boolean;
  searchMode?: "icon" | "field";
};

export function Navbar({
  showSecondaryNav = true,
  searchMode = "icon",
}: NavbarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useWishlist();
  const { totalItems } = useCart();
  const navRef = useRef<HTMLDivElement>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPincodeOpen, setIsPincodeOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { selectedPincode, setPincode } = useLocation();

  // Display label: show pincode if set, otherwise prompt
  const pincodeLabel = /^\d{6}$/.test(selectedPincode) ? selectedPincode : "Enter Pincode";

  // Reflect the real Supabase session and keep it live across login/logout.
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setIsLoggedIn(!!session?.user),
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isCategoryOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isCategoryOpen]);

  const handleLogoClick = () => {
    router.push("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsCategoryOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleSavePincode = (value: string) => {
    setPincode(value); // locationStore handles localStorage persistence
  };

  const profileHref = isLoggedIn ? "/profile" : "/login";
  const isSearchActive = pathname.startsWith("/search");
  const isWishlistActive = pathname.startsWith("/wishlist");
  const isCartActive = pathname.startsWith("/cart");
  const isProfileActive = pathname.startsWith("/profile");
  const isLoginActive = pathname.startsWith("/login");

  return (
    <>
      <header
        id="top"
        className="sticky top-0 z-40 border-b border-gray-200 bg-[#f8f6f3]/95 backdrop-blur-sm"
      >
        <div ref={navRef} className="relative border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 md:px-10 lg:px-12">
            <nav className="hidden items-center gap-8 text-xs uppercase tracking-widest text-gray-600 md:flex">
              {topLinks.map((item) =>
                item.isTrigger ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setIsCategoryOpen((current) => !current)}
                    className={`group relative inline-flex items-center gap-2 pb-2 transition-colors duration-200 hover:text-black ${
                      isActive(pathname, item.href) ? "text-black" : ""
                    }`}
                    aria-expanded={isCategoryOpen}
                    aria-controls="fitzo-mega-menu"
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={`transition duration-200 ${isCategoryOpen ? "rotate-180" : ""}`}
                    />
                    <span
                      className={`pointer-events-none absolute bottom-0 left-0 h-[1.5px] w-full bg-black origin-left transition-all duration-300 ease-out ${
                        isActive(pathname, item.href)
                          ? "scale-x-100 opacity-100"
                          : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
                      }`}
                    />
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group relative inline-block pb-2 transition-colors duration-200 hover:text-black ${
                      isActive(pathname, item.href) ? "text-black" : ""
                    }`}
                    onClick={() => {
                      setIsCategoryOpen(false);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`pointer-events-none absolute bottom-0 left-0 h-[1.5px] w-full bg-black origin-left transition-all duration-300 ease-out ${
                        isActive(pathname, item.href)
                          ? "scale-x-100 opacity-100"
                          : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
                      }`}
                    />
                  </Link>
                ),
              )}
            </nav>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d2c8] text-[#3a3a3a] md:hidden"
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="block h-px w-4 bg-current shadow-[0_5px_0_0_currentColor,0_-5px_0_0_currentColor]" />
            </button>

            <button
              type="button"
              onClick={handleLogoClick}
              className="absolute left-1/2 -translate-x-1/2 font-serif text-xl font-medium tracking-[0.3em] text-gray-800 transition duration-200 hover:text-black"
            >
              FITZO
            </button>

            <div className="ml-auto flex items-center gap-3 text-gray-700 sm:gap-5">
              <button
                type="button"
                onClick={() => setIsPincodeOpen(true)}
                className="hidden items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition duration-200 hover:-translate-y-0.5 hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd233]/70 md:flex"
              >
                <PinIcon />
                <span>{pincodeLabel}</span>
                <ChevronDown />
              </button>

              {searchMode === "field" ? (
                <>
                  <button
                    type="button"
                    onClick={() => router.push("/search")}
                    className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-[#1f2a3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd233]/70 md:hidden ${
                      isSearchActive ? "text-[#1f2a3c]" : "text-[#6f6860]"
                    }`}
                    aria-label="Search"
                  >
                    <SearchIcon />
                    <span
                      className={`pointer-events-none absolute -bottom-1 left-1/2 h-[1.5px] w-5 -translate-x-1/2 rounded-full bg-[#1f2a3c] transition duration-200 ${
                        isSearchActive ? "opacity-100" : "opacity-0 group-hover:opacity-45"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/search")}
                    className={`group relative hidden h-10 items-center gap-3 rounded-md bg-white px-4 text-[13px] shadow-[inset_0_0_0_1px_rgba(215,207,198,0.85)] transition duration-200 hover:-translate-y-0.5 hover:text-[#1f2a3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd233]/70 md:flex ${
                      isSearchActive ? "text-[#1f2a3c]" : "text-[#78726a]"
                    }`}
                    aria-label="Search"
                  >
                    <span>Search</span>
                    <SearchIcon />
                    <span
                      className={`pointer-events-none absolute -bottom-1 left-1/2 h-[1.5px] w-5 -translate-x-1/2 rounded-full bg-[#1f2a3c] transition duration-200 ${
                        isSearchActive ? "opacity-100" : "opacity-0 group-hover:opacity-45"
                      }`}
                    />
                  </button>
                </>
              ) : (
                <NavIconButton
                  label="Search"
                  active={isSearchActive}
                  onClick={() => router.push("/search")}
                >
                  <SearchIcon />
                </NavIconButton>
              )}

              <NavIconButton
                label="Wishlist"
                active={isWishlistActive}
                onClick={() => router.push("/wishlist")}
                badge={count}
              >
                <HeartIcon />
              </NavIconButton>

              <NavIconButton
                label="Cart"
                active={isCartActive}
                onClick={() => router.push("/bag")}
                badge={totalItems}
              >
                <BagIcon />
              </NavIconButton>

              <NavIconButton
                label={isLoggedIn ? "Profile" : "Login"}
                active={isProfileActive}
                onClick={() => router.push(profileHref)}
              >
                <UserIcon />
              </NavIconButton>

              {!isLoggedIn ? (
                <Link
                  href="/login"
                  className={`group relative hidden h-10 items-center rounded-full border bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#1f2a3c] shadow-[0_10px_24px_rgba(25,31,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#1f2a3c] hover:bg-[#fff9e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd233]/70 md:inline-flex lg:px-4 lg:text-[11px] ${
                    isLoginActive ? "border-[#1f2a3c]" : "border-[#d8cbb9]"
                  }`}
                >
                  Login / Signup
                  <span
                    className={`pointer-events-none absolute -bottom-1 left-1/2 h-[1.5px] w-8 -translate-x-1/2 rounded-full bg-[#1f2a3c] transition duration-200 ${
                      isLoginActive ? "opacity-100" : "opacity-0 group-hover:opacity-45"
                    }`}
                  />
                </Link>
              ) : null}
            </div>
          </div>

          {isCategoryOpen ? (
            <div
              id="fitzo-mega-menu"
              className="absolute inset-x-0 top-full z-50 border-t border-[#ebe1d6] bg-[#fffdf9] shadow-[0_24px_60px_rgba(22,22,22,0.08)]"
            >
              <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-5 md:px-10 lg:px-12">
                {megaCategories.map((category) => (
                  <div key={category.title}>
                    <Link
                      href={category.href}
                      onClick={() => setIsCategoryOpen(false)}
                      className="font-serif text-[24px] text-[#171717] transition duration-200 hover:text-[#575757]"
                    >
                      {category.title}
                    </Link>
                    <div className="mt-4 space-y-3">
                      {category.links.map((link) => (
                        <Link
                          key={link.label}
                          href={link.href}
                          onClick={() => setIsCategoryOpen(false)}
                          className="block text-[13px] text-[#6d665d] transition duration-200 hover:text-black"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isMobileMenuOpen ? (
            <div className="border-t border-[#ebe1d6] bg-[#fffdf9] px-6 py-5 md:hidden">
              <div className="space-y-4 text-sm uppercase tracking-[0.18em] text-[#57524b]">
                {topLinks.map((item) =>
                  item.isTrigger ? (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setIsCategoryOpen((current) => !current)}
                      className={`flex w-full items-center justify-between ${
                        isActive(pathname, item.href) ? "text-black font-semibold" : ""
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`transition duration-200 ${isCategoryOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`block ${
                        isActive(pathname, item.href) ? "text-black font-semibold" : ""
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setIsPincodeOpen(true)}
                  className="flex items-center gap-2 text-left"
                >
                  <PinIcon />
                  <span>{pincodeLabel}</span>
                </button>
                {isLoggedIn ? (
                  <Link
                    href="/profile"
                    className={`flex items-center justify-between rounded-2xl border border-[#e3d7c8] bg-white px-4 py-3 font-semibold text-[#1f2a3c] ${
                      isProfileActive ? "ring-1 ring-[#1f2a3c]" : ""
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>Profile</span>
                    <ChevronDown className="-rotate-90" />
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className={`flex items-center justify-between rounded-2xl border border-[#e3d7c8] bg-[#fff9e6] px-4 py-3 font-semibold text-[#1f2a3c] ${
                      isLoginActive ? "ring-1 ring-[#1f2a3c]" : ""
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>Login / Signup</span>
                    <ChevronDown className="-rotate-90" />
                  </Link>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {showSecondaryNav ? (
          <div className="px-6 py-2 md:px-10 lg:px-12">
            <div className="flex items-center justify-center overflow-x-auto hide-scrollbar">
              <nav className="flex min-w-max items-center gap-8 text-sm uppercase tracking-widest text-gray-600">
                {categoryLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2 transition duration-200 hover:text-black"
                  >
                    <span>{item.label}</span>
                    <ChevronDown />
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        ) : null}
      </header>

      <PincodeModal
        isOpen={isPincodeOpen}
        onClose={() => setIsPincodeOpen(false)}
        onSave={handleSavePincode}
        currentValue={selectedPincode}
      />
    </>
  );
}
