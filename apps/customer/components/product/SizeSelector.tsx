"use client";

import { useState } from "react";
import { SizeOption } from "@/components/product/types";
import { SizeChartModal } from "@/components/product/SizeChartModal";

type SizeSelectorProps = {
  sizes: SizeOption[];
  selectedSize: string;
  onChange: (value: string) => void;
};

/**
 * 4 visual states (Snitch-style):
 *  1. Available  + not selected → white bg, grey border
 *  2. Available  + selected     → dark bg, dark border, white text
 *  3. Sold-out   + not selected → grey bg, light border, grey strikethrough text
 *  4. Sold-out   + selected     → grey bg, DARK border + strikethrough (picked but OOS)
 *
 * Sold-out sizes are CLICKABLE — user can still select & add to bag.
 * "Free Size" shown when no variants are configured.
 */
export function SizeSelector({ sizes, selectedSize, onChange }: SizeSelectorProps) {
  const [chartOpen, setChartOpen] = useState(false);

  if (!sizes.length) return null;

  const isFreeSize = sizes.length === 1 && sizes[0].label === "Free Size";
  const hasSoldOut = sizes.some((s) => !s.available);
  const hasAvailable = sizes.some((s) => s.available);

  return (
    <>
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#171717]">
            {isFreeSize ? "Size" : "Sizes"}
            {selectedSize && !isFreeSize && (
              <span className="ml-2 text-[13px] font-normal normal-case tracking-normal text-[#5c5650]">
                — {selectedSize}
                {!sizes.find((s) => s.label === selectedSize)?.available && (
                  <span className="ml-1 text-[11px] text-[#c0392b]">(sold out)</span>
                )}
              </span>
            )}
            {!selectedSize && !isFreeSize && (
              <span className="ml-2 text-[13px] font-normal normal-case tracking-normal text-[#c0392b]">
                — select a size
              </span>
            )}
          </p>

          {!isFreeSize && (
            <button
              type="button"
              onClick={() => setChartOpen(true)}
              className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#514c45] underline underline-offset-4 transition duration-200 hover:text-black"
            >
              Size Chart
            </button>
          )}
        </div>

        {/* Size buttons grid */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          {isFreeSize ? (
            <div className="inline-flex min-w-[80px] items-center justify-center rounded-[10px] border border-[#171d2b] bg-[#171d2b] px-5 py-3 text-[14px] font-medium text-white">
              Free Size
            </div>
          ) : (
            sizes.map(({ label, available }) => {
              const isSelected = selectedSize === label;

              let cls = "";
              if (available && isSelected) {
                cls = "border-[#171d2b] bg-[#171d2b] text-white shadow-[0_4px_10px_rgba(23,29,43,0.22)]";
              } else if (available) {
                cls = "border-[#c0b9b1] bg-white text-[#2b2b2b] hover:border-[#171d2b] hover:bg-[#f7f5f2]";
              } else if (isSelected) {
                cls = "border-[#171d2b] bg-[#f0ece8] text-[#9e9690]";
              } else {
                cls = "border-[#d8d3cd] bg-[#f5f3f0] text-[#b0a89e] hover:border-[#a09890]";
              }

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange(label)}
                  title={available ? label : `${label} — Sold out`}
                  className={`relative min-w-[52px] overflow-hidden rounded-[10px] border px-4 py-3 text-[14px] font-medium transition duration-200 ${cls}`}
                >
                  {!available && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                      <span className="absolute left-0 top-1/2 h-px w-full origin-center -translate-y-1/2 rotate-[-20deg] bg-[#c5bdb5]" />
                    </span>
                  )}
                  {label}
                </button>
              );
            })
          )}
        </div>

        {/* Legend — only when both states coexist */}
        {!isFreeSize && hasSoldOut && hasAvailable && (
          <p className="mt-3 flex items-center gap-4 text-[11px] text-[#8a8078]">
            <span className="flex items-center gap-1.5">
              <span className="relative inline-block h-4 w-4 overflow-hidden rounded-[3px] border border-[#d8d3cd] bg-[#f5f3f0]">
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 rotate-[-20deg] bg-[#c5bdb5]" />
              </span>
              Sold out
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-4 w-4 rounded-[3px] border border-[#c0b9b1] bg-white" />
              Available
            </span>
          </p>
        )}

        {/* All sold out notice */}
        {!isFreeSize && hasSoldOut && !hasAvailable && (
          <p className="mt-3 text-[12px] text-[#c0392b]">
            All sizes are currently sold out. You can still add to bag to request restocking.
          </p>
        )}
      </div>

      {/* Size chart modal — rendered outside the div to avoid stacking context issues */}
      <SizeChartModal
        isOpen={chartOpen}
        onClose={() => setChartOpen(false)}
        selectedSize={selectedSize}
      />
    </>
  );
}
