import type { SVGProps } from "react";

/*
 * Stroke-based icon set for the agent panel (replaces emoji — emoji render
 * inconsistently on budget Androids). All icons inherit currentColor and take
 * a `size` prop; default 20.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconHome(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function IconScooter(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M8 17.5h8" />
      <path d="M18.5 17.5 16 8h-3" />
      <path d="M14.5 5H16l1 3" />
      <path d="M5.5 17.5 7 12h4l1.5 5.5" />
    </svg>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="6" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M15.5 15h2" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconBellOff(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6.4 6.4A6 6 0 0 0 6 9.5c0 4-1.5 5.5-2 6h12" />
      <path d="M18 13.7c-.3-1-.5-2.3-.5-4.2a6 6 0 0 0-8.6-5.4" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
      <path d="m4 4 16 16" />
    </svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function IconGear(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.15-1.45l2.05-1.6-2-3.45-2.45 1a7 7 0 0 0-2.5-1.45L13.5 2.5h-3l-.45 2.55a7 7 0 0 0-2.5 1.45l-2.45-1-2 3.45 2.05 1.6a7.1 7.1 0 0 0 0 2.9L3.1 15.05l2 3.45 2.45-1a7 7 0 0 0 2.5 1.45l.45 2.55h3l.45-2.55a7 7 0 0 0 2.5-1.45l2.45 1 2-3.45-2.05-1.6A7 7 0 0 0 19 12Z" />
    </svg>
  );
}

export function IconLifebuoy(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5.7 5.7 3.8 3.8M14.5 14.5l3.8 3.8M18.3 5.7l-3.8 3.8M9.5 14.5l-3.8 3.8" />
    </svg>
  );
}

export function IconBook(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17.5H6.5A2.5 2.5 0 0 0 4 22V4.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  );
}

export function IconDots(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPhone(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 3.5h3.5L10 8l-2 1.5a12.5 12.5 0 0 0 6.5 6.5L16 14l4.5 1.5V19a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3 5.5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function IconMapPin(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 21.5s7-6.1 7-11.5a7 7 0 1 0-14 0c0 5.4 7 11.5 7 11.5Z" />
      <circle cx="12" cy="9.8" r="2.5" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5.5 9 6.5 6.5L18.5 9" />
    </svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9 5.5 6.5 6.5L9 18.5" />
    </svg>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20 12H4M10.5 5.5 4 12l6.5 6.5" />
    </svg>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" />
      <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export function IconPackage(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m12 2.5 8.5 4.5v10L12 21.5 3.5 17V7L12 2.5Z" />
      <path d="M3.5 7 12 11.5 20.5 7" />
      <path d="M12 11.5v10" />
    </svg>
  );
}

export function IconMail(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </svg>
  );
}

export function IconShirt(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m8.5 3.5-5 3 2 3.5L8 8.7V20.5h8V8.7l2.5 1.3 2-3.5-5-3a3.5 3.5 0 0 1-7 0Z" />
    </svg>
  );
}

export function IconRupee(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6.5 3.5h11M6.5 8h11M6.5 3.5H10a4.5 4.5 0 0 1 0 9H6.5l7.5 8" />
    </svg>
  );
}

export function IconHourglass(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M8 3v3.5c0 2.5 4 4 4 5.5s-4 3-4 5.5V21M16 3v3.5c0 2.5-4 4-4 5.5s4 3 4 5.5V21" />
    </svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M19.5 11a8 8 0 0 0-14-3.5M4.5 13a8 8 0 0 0 14 3.5" />
    </svg>
  );
}
