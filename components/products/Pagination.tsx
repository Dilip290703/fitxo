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

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pageItems: Array<number | "ellipsis"> = [];

  if (totalPages <= 4) {
    for (let page = 1; page <= totalPages; page += 1) {
      pageItems.push(page);
    }
  } else {
    pageItems.push(1, 2, "ellipsis", totalPages);
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-8 w-8 items-center justify-center border border-[#e3ddd5] bg-[#f2f0ec] text-[#353535] transition duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Chevron direction="left" />
      </button>

      {pageItems.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-8 w-8 items-center justify-center border border-[#ece7df] text-[12px] text-[#77716a]"
          >
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={`flex h-8 w-8 items-center justify-center border text-[12px] transition duration-200 ${
              currentPage === item
                ? "border-[#1a2030] bg-[#1a2030] text-white"
                : "border-[#ece7df] bg-white text-[#4a453f] hover:bg-[#f8f6f3]"
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
        className="flex h-8 w-8 items-center justify-center border border-[#1a2030] bg-[#1a2030] text-white transition duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}
