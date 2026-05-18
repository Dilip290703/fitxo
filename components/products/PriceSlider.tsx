"use client";

type PriceSliderProps = {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

export function PriceSlider({
  min,
  max,
  value,
  onChange,
}: PriceSliderProps) {
  const [minValue, maxValue] = value;
  const left = ((minValue - min) / (max - min)) * 100;
  const right = ((maxValue - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[#58524a]">
        <span>Range</span>
        <span>${minValue.toFixed(0)} - ${maxValue.toFixed(0)}</span>
      </div>

      <div className="relative mt-6 h-6">
        <div className="absolute top-1/2 h-[2px] w-full -translate-y-1/2 bg-[#e7e1d8]" />
        <div
          className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-[#f15a5a]"
          style={{ left: `${left}%`, right: `${100 - right}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          value={minValue}
          onChange={(event) =>
            onChange([
              Math.min(Number(event.target.value), maxValue - 10),
              maxValue,
            ])
          }
          className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f15a5a] [&::-webkit-slider-thumb]:shadow-none"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxValue}
          onChange={(event) =>
            onChange([
              minValue,
              Math.max(Number(event.target.value), minValue + 10),
            ])
          }
          className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f15a5a] [&::-webkit-slider-thumb]:shadow-none"
        />
      </div>
    </div>
  );
}
