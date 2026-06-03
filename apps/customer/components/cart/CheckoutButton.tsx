import Link from "next/link";

type CheckoutButtonProps = {
  href?: string;
  label: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function CheckoutButton({
  href,
  label,
  className = "",
  onClick,
  disabled = false,
}: CheckoutButtonProps) {
  const baseClass = `inline-flex w-full items-center justify-center rounded-[16px] bg-black px-6 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] !text-white visited:!text-white hover:!text-white transition duration-300 hover:opacity-90 ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${baseClass} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "/checkout"}
      className={baseClass}
    >
      {label}
    </Link>
  );
}
