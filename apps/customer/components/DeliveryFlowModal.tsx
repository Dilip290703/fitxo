"use client";

type DeliveryFlowModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const flowSteps = [
  "Pick styles from nearby stores",
  "Book a delivery slot that suits you",
  "Try everything on while the rider waits",
  "Keep what you love, hand the rest back on the spot",
];

export function DeliveryFlowModal({
  isOpen,
  onClose,
}: DeliveryFlowModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-2xl rounded-[30px] bg-[#fffdf9] p-8 shadow-[0_35px_80px_rgba(20,20,20,0.2)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
              Delivery flow
            </p>
            <h2 className="mt-3 font-display text-[38px] leading-none text-[#171717]">
              How FitZo brings the fitting room to your door.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#6f6a63] transition duration-200 hover:bg-[#f4ede4] hover:text-black"
            aria-label="Close delivery flow modal"
          >
            ✕
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {flowSteps.map((step, index) => (
            <div
              key={step}
              className="rounded-[20px] border border-[#eadfd4] bg-[#fcfaf7] px-5 py-5"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
                Step 0{index + 1}
              </p>
              <p className="mt-3 text-[16px] leading-7 text-[#222]">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
