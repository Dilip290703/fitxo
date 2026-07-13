"use client";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${direction === "left" ? "" : "rotate-180"}`}
    >
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * First / last always visible, a window of pages around the current one,
 * ellipses only where pages are actually skipped. The old version rendered
 * a fixed "1 2 … last" no matter where you were, so pages 3+ were
 * unreachable except through the arrows.
 */
function buildPageItems(currentPage: number, totalPages: number) {
  const items: Array<number | "ellipsis"> = [];
  const window = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  let previous = 0;
  for (let page = 1; page <= totalPages; page += 1) {
    if (!window.has(page)) continue;
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
    previous = page;
  }
  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pageItems = buildPageItems(currentPage, totalPages);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="flex h-9 w-9 items-center justify-center border border-[#cbb9a4] bg-white text-[#221b13] transition duration-200 hover:border-[#221b13] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Chevron direction="left" />
      </button>

      {pageItems.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-9 w-9 items-end justify-center pb-2 text-[12px] text-[#a48d78]"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={currentPage === item ? "page" : undefined}
            className={`flex h-9 w-9 items-center justify-center border text-[12px] transition duration-200 ${
              currentPage === item
                ? "border-[#221b13] bg-[#221b13] text-[#faf9f6]"
                : "border-[#e6dac8] bg-white text-[#221b13] hover:border-[#221b13]"
            }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="flex h-9 w-9 items-center justify-center border border-[#cbb9a4] bg-white text-[#221b13] transition duration-200 hover:border-[#221b13] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Chevron direction="right" />
      </button>
    </nav>
  );
}
