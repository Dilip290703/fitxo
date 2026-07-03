const VARIANT_CLASS = {
  error: "border-danger-line bg-danger-bg text-danger",
  success: "border-success-line bg-success-bg text-success",
  info: "border-line bg-cream text-body",
} as const;

/** Inline message banner. `error` renders with role="alert". */
export function Banner({
  variant,
  children,
  className = "",
}: {
  variant: keyof typeof VARIANT_CLASS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={variant === "error" ? "alert" : undefined}
      className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </p>
  );
}
