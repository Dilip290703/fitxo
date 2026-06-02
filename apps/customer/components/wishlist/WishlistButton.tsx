"use client";

import { useWishlist, type WishlistItem } from "@/store/wishlistStore";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12.1 20.3l-.1.1-.11-.1C7 15.9 4 13.17 4 9.8 4 7.03 6.02 5 8.6 5c1.46 0 2.86.67 3.78 1.72C13.3 5.67 14.7 5 16.16 5 18.74 5 20.76 7.03 20.76 9.8c0 3.37-3 6.1-8.66 10.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

type WishlistButtonProps = {
  item: WishlistItem;
  className?: string;
  filledClassName?: string;
  defaultClassName?: string;
  iconClassName?: string;
};

export function WishlistButton({
  item,
  className = "",
  filledClassName = "",
  defaultClassName = "",
  iconClassName = "h-4 w-4",
}: WishlistButtonProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wished = isWishlisted(item.id);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(item);
      }}
      className={`transition duration-200 ${className} ${
        wished ? filledClassName : defaultClassName
      }`}
      aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
    >
      <span
        className={`block transition duration-200 ${wished ? "scale-110" : "scale-100"}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClassName}>
          <path
            d="M12.1 20.3l-.1.1-.11-.1C7 15.9 4 13.17 4 9.8 4 7.03 6.02 5 8.6 5c1.46 0 2.86.67 3.78 1.72C13.3 5.67 14.7 5 16.16 5 18.74 5 20.76 7.03 20.76 9.8c0 3.37-3 6.1-8.66 10.5z"
            fill={wished ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      </span>
    </button>
  );
}
