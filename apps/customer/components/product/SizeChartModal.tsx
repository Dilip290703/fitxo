"use client";

import { useEffect, useState } from "react";
import { SIZE_DATA, formatMeasure as fmt } from "@/lib/sizeData";

// ─── SVG illustrations ────────────────────────────────────────────────────────

/** Front view — Chest + Front Length arrows */
function TshirtFront() {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full"
      aria-hidden="true"
    >
      {/* ── Shirt body ── */}
      <path
        d="M62 38 C62 38 74 26 100 24 C126 26 138 38 138 38
           L168 68 L148 78 L148 220 L52 220 L52 78 L32 68 Z"
        stroke="#c5bdb5" strokeWidth="1.4" fill="#faf8f5"
      />
      {/* Collar */}
      <path d="M78 36 Q100 52 122 36" stroke="#c5bdb5" strokeWidth="1.4" fill="none" />
      {/* Sleeve seam left */}
      <path d="M62 38 L32 68 L52 78 L68 56" stroke="#c5bdb5" strokeWidth="1.4" fill="#faf8f5" />
      {/* Sleeve seam right */}
      <path d="M138 38 L168 68 L148 78 L132 56" stroke="#c5bdb5" strokeWidth="1.4" fill="#faf8f5" />

      {/* ── Chest measurement (horizontal) ── */}
      <line x1="56" y1="116" x2="144" y2="116" stroke="#c76b4d" strokeWidth="1" strokeDasharray="4 3" />
      <polygon points="56,116 63,112 63,120" fill="#c76b4d" />
      <polygon points="144,116 137,112 137,120" fill="#c76b4d" />
      <text x="100" y="110" fontSize="9" fill="#c76b4d" textAnchor="middle" fontFamily="sans-serif">Chest</text>

      {/* ── Front Length measurement (vertical) ── */}
      <line x1="110" y1="30" x2="110" y2="216" stroke="#c76b4d" strokeWidth="1" strokeDasharray="4 3" />
      <polygon points="110,30 106,38 114,38" fill="#c76b4d" />
      <polygon points="110,216 106,208 114,208" fill="#c76b4d" />
      <text x="115" y="128" fontSize="9" fill="#c76b4d" fontFamily="sans-serif">Front</text>
      <text x="115" y="140" fontSize="9" fill="#c76b4d" fontFamily="sans-serif">Length</text>

      {/* ── Label ── */}
      <text x="100" y="234" fontSize="9" fill="#9a918a" textAnchor="middle" fontFamily="sans-serif" letterSpacing="2">FRONT</text>
    </svg>
  );
}

/** Back view — Shoulder + Sleeve arrows */
function TshirtBack() {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full"
      aria-hidden="true"
    >
      {/* ── Shirt body ── */}
      <path
        d="M62 38 C62 38 74 26 100 24 C126 26 138 38 138 38
           L168 68 L148 78 L148 220 L52 220 L52 78 L32 68 Z"
        stroke="#c5bdb5" strokeWidth="1.4" fill="#faf8f5"
      />
      {/* Collar (back — slight arc) */}
      <path d="M82 34 Q100 40 118 34" stroke="#c5bdb5" strokeWidth="1.4" fill="none" />
      {/* Sleeve seam left */}
      <path d="M62 38 L32 68 L52 78 L68 56" stroke="#c5bdb5" strokeWidth="1.4" fill="#faf8f5" />
      {/* Sleeve seam right */}
      <path d="M138 38 L168 68 L148 78 L132 56" stroke="#c5bdb5" strokeWidth="1.4" fill="#faf8f5" />

      {/* ── Shoulder measurement (horizontal near top) ── */}
      <line x1="63" y1="53" x2="137" y2="53" stroke="#c76b4d" strokeWidth="1" strokeDasharray="4 3" />
      <polygon points="63,53 70,49 70,57" fill="#c76b4d" />
      <polygon points="137,53 130,49 130,57" fill="#c76b4d" />
      <text x="100" y="47" fontSize="9" fill="#c76b4d" textAnchor="middle" fontFamily="sans-serif">Shoulder</text>

      {/* ── Sleeve measurement (diagonal on right sleeve) ── */}
      <line x1="138" y1="42" x2="165" y2="66" stroke="#c76b4d" strokeWidth="1" strokeDasharray="4 3" />
      <polygon points="138,42 144,41 141,48" fill="#c76b4d" />
      <polygon points="165,66 158,67 161,60" fill="#c76b4d" />
      <text x="150" y="42" fontSize="9" fill="#c76b4d" fontFamily="sans-serif">Sleeve</text>

      {/* ── Label ── */}
      <text x="100" y="234" fontSize="9" fill="#9a918a" textAnchor="middle" fontFamily="sans-serif" letterSpacing="2">BACK</text>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = "chart" | "measure";

type SizeChartModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedSize?: string;
};

export function SizeChartModal({ isOpen, onClose, selectedSize }: SizeChartModalProps) {
  const [tab, setTab] = useState<Tab>("chart");
  const [unit, setUnit] = useState<"cm" | "in">("cm");

  // Reset to SIZE CHART tab each open
  useEffect(() => { if (isOpen) { setTab("chart"); } }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /*
     * z-[9999] beats:
     *   - sticky navbar (z-40)
     *   - navbar dropdown (z-50)
     *   - ProductGallery floating buttons (z-10 inside relative)
     */
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-end sm:justify-center sm:p-6">

      {/* ── Backdrop ── */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Modal panel ── */}
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white sm:rounded-[24px] sm:shadow-[0_32px_80px_rgba(0,0,0,0.24)]"
        style={{ maxHeight: "min(92dvh, 700px)" }}
      >

        {/* ── Sticky header ── */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#ece4da] bg-white px-6 py-4">
          {/* Tabs */}
          <div className="flex rounded-full bg-[#f4f1ec] p-1">
            {(["chart", "measure"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition duration-200 ${
                  tab === t
                    ? "bg-[#171d2b] text-white shadow-sm"
                    : "text-[#7a7169] hover:text-[#171717]"
                }`}
              >
                {t === "chart" ? "Size Chart" : "How to Measure"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* CM / IN toggle — only on chart tab */}
            {tab === "chart" && (
              <div className="flex items-center rounded-full border border-[#ddd4c9] bg-[#f7f4f0] p-0.5">
                {(["cm", "in"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] transition duration-200 ${
                      unit === u
                        ? "bg-[#171d2b] text-white shadow-sm"
                        : "text-[#7a7169] hover:text-black"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[22px] font-light text-[#6f6860] transition duration-200 hover:bg-[#f4ede4] hover:text-black"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="overflow-y-auto overscroll-contain">

          {/* SIZE CHART */}
          {tab === "chart" && (
            <div>
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-[#faf8f5]">
                  <tr className="border-b border-[#ece4da]">
                    <th className="py-3 pl-6 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a918a]">
                      Size
                    </th>
                    {["Chest", "Length", "Shoulder", "Sleeve"].map((h) => (
                      <th key={h} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a918a]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SIZE_DATA.map((row, i) => {
                    const isSelected = row.size === selectedSize;
                    return (
                      <tr
                        key={row.size}
                        className={`border-b border-[#f0ebe4] ${
                          isSelected
                            ? "bg-[#f4ede4]"
                            : i % 2 === 0 ? "bg-white" : "bg-[#fdfcfa]"
                        }`}
                      >
                        <td className="py-3 pl-6 pr-3">
                          <span className={`text-[13px] ${isSelected ? "font-bold text-[#171717]" : "text-[#3b3732]"}`}>
                            {row.size}
                            {isSelected && (
                              <span className="ml-1.5 text-[10px] font-semibold text-[#c76b4d]">◀</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-[#3b3732]">{fmt(row.chest, unit)}</td>
                        <td className="px-3 py-3 text-center text-[#3b3732]">{fmt(row.length, unit)}</td>
                        <td className="px-3 py-3 text-center text-[#3b3732]">{fmt(row.shoulder, unit)}</td>
                        <td className="px-3 py-3 text-center text-[#3b3732]">{fmt(row.sleeve, unit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-6 py-4 text-[12px] text-[#9a918a]">
                Measurements in {unit === "cm" ? "centimeters" : "inches"}. Sizes may vary slightly between brands.
              </p>
            </div>
          )}

          {/* HOW TO MEASURE */}
          {tab === "measure" && (
            <div className="px-5 pb-8 pt-5 sm:px-8">
              <p className="mb-6 text-[13px] leading-6 text-[#5c5650]">
                Measure yourself as shown below and compare with the size chart.
                Use a soft tape measure and keep it flat against your body.
              </p>

              {/* Two diagrams side by side */}
              <div className="grid grid-cols-2 gap-4 sm:gap-8">
                {/* FRONT */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-[160px] sm:max-w-[180px]">
                    <TshirtFront />
                  </div>
                  <div className="w-full space-y-4 text-center">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#171717]">Chest</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#6c655e]">
                        Measure around the fullest part of your chest, keeping tape parallel to the ground.
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#171717]">Front Length</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#6c655e]">
                        Measure from the highest point of the shoulder down to the hem.
                      </p>
                    </div>
                  </div>
                </div>

                {/* BACK */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-[160px] sm:max-w-[180px]">
                    <TshirtBack />
                  </div>
                  <div className="w-full space-y-4 text-center">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#171717]">Shoulder</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#6c655e]">
                        Measure across the back from shoulder seam to shoulder seam.
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#171717]">Sleeve</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#6c655e]">
                        Measure from the shoulder seam to the end of the sleeve cuff.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pro tip */}
              <div className="mt-6 rounded-[14px] bg-[#f4ede4] px-5 py-4">
                <p className="text-[12px] font-semibold text-[#8b7058]">💡 Pro tip</p>
                <p className="mt-1.5 text-[12px] leading-5 text-[#5f5851]">
                  Between sizes? Size up for a relaxed fit, down for slim. FitXo&apos;s
                  doorstep try-on lets you compare multiple sizes while the rider waits before you decide.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
