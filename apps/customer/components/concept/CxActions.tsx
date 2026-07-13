import { CxIcon, CX_ICONS } from "@/components/concept/shared";

/**
 * Hover action row for product cards (Fitzo landing):
 * heart / quick-view / compare / cart circles slide up + fade in on card
 * hover. Parent card must be `group` + `relative`.
 */
const ACTIONS = [
  { label: "Wishlist", icon: CX_ICONS.heart },
  { label: "Quick view", icon: CX_ICONS.eye },
  { label: "Compare", icon: CX_ICONS.swap },
  { label: "Add to cart", icon: CX_ICONS.bag },
];

export function CxActions() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex translate-y-3 justify-center gap-2 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100">
      {ACTIONS.map((a, i) => (
        <button
          key={a.label}
          aria-label={a.label}
          style={{ transitionDelay: `${i * 40}ms` }}
          className="pointer-events-auto grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-white text-[#1a1a1a] opacity-0 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.35)] transition-all duration-300 hover:bg-[#b0703f] hover:text-white group-hover:translate-y-0 group-hover:opacity-100"
        >
          <CxIcon path={a.icon} className="h-[18px] w-[18px]" />
        </button>
      ))}
    </div>
  );
}
