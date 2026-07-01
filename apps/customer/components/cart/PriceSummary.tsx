type PriceSummaryProps = {
  subtotal: number;
  discount: number;
  delivery?: number;
};

function formatPrice(value: number) {
  return `₹${Math.round(value)}`;
}

export function PriceSummary({ subtotal, discount, delivery = 0 }: PriceSummaryProps) {
  const finalTotal = Math.max(0, subtotal - discount + delivery);

  return (
    <div className="rounded-[22px] border border-[#ece4da] bg-white px-6 py-6">
      <h3 className="text-[24px] font-display leading-none text-[#171717]">
        Price Details
      </h3>

      <div className="mt-6 space-y-4 text-[15px] text-[#3b3732]">
        <div className="flex items-center justify-between">
          <span>Bag Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Delivery</span>
          <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Coupon Discount</span>
          <span>- {formatPrice(discount)}</span>
        </div>
      </div>

      <div className="mt-6 border-t border-[#ece4da] pt-5">
        <div className="flex items-center justify-between text-[18px] font-semibold text-[#171717]">
          <span>Grand Total</span>
          <span>{formatPrice(finalTotal)}</span>
        </div>
      </div>
    </div>
  );
}
