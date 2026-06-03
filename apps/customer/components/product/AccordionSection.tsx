"use client";

type AccordionSectionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <div className="border-b border-[#e8dfd5]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-6 text-left"
      >
        <span className="text-[15px] font-medium uppercase tracking-[0.05em] text-[#171717]">
          {title}
        </span>
        <span className="text-[30px] font-light leading-none text-[#232323]">
          {open ? "−" : "+"}
        </span>
      </button>

      <div
        className={`grid overflow-hidden transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 text-[14px] leading-7 text-[#5a544f]">
          {children}
        </div>
      </div>
    </div>
  );
}
