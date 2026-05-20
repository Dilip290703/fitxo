"use client";

type SizeSelectorProps = {
  sizes: string[];
  selectedSize: string;
  onChange: (value: string) => void;
};

export function SizeSelector({
  sizes,
  selectedSize,
  onChange,
}: SizeSelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#171717]">
          Sizes
        </p>
        <button
          type="button"
          className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#514c45] underline underline-offset-4 transition duration-200 hover:text-black"
        >
          Size Chart
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            className={`min-w-[52px] rounded-[10px] border px-4 py-3 text-[14px] transition duration-200 ${
              selectedSize === size
                ? "border-[#171d2b] bg-[#171d2b] text-white"
                : "border-[#bdb6ae] bg-white text-[#2b2b2b] hover:border-[#171d2b]"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
