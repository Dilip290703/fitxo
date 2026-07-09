"use client";

type NewsletterModalProps = {
  isOpen: boolean;
  message: string;
  onClose: () => void;
};

export function NewsletterModal({
  isOpen,
  message,
  onClose,
}: NewsletterModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-[20px] border border-[#e6ddd1] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(26,22,18,0.14)]">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#a48d78] text-[14px] font-black text-black">
          ✓
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
            FitZo update
          </p>
          <p className="mt-2 text-[14px] leading-6 text-[#2c2c2c]">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#6f6a63] transition duration-200 hover:text-black"
          aria-label="Close newsletter toast"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
