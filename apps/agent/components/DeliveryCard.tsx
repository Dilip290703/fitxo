import Link from "next/link";
import { StatusPill } from "@/components/status";
import type { DeliveryListItem } from "@/lib/deliveries";
import { inr } from "@/components/ui";

export function DeliveryCard({ d }: { d: DeliveryListItem }) {
  const addr = d.drop_address;
  const place = [addr.line1, addr.city, addr.pincode].filter(Boolean).join(", ");
  return (
    <Link
      href={`/deliveries/${d.id}`}
      className="block rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4 transition hover:border-[#3b82f6]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold">{d.order?.order_number ?? "Order"}</p>
        <StatusPill status={d.status} />
      </div>
      <p className="mt-1 text-[13px] text-[#9fb0cc]">{place || "Address on file"}</p>
      <div className="mt-3 flex items-center justify-between border-t border-[#22304a] pt-3">
        <span className="text-[12px] text-[#7c8aa5]">
          {addr.full_name ? `For ${addr.full_name}` : "Customer"}
        </span>
        <span className="text-[13px] font-semibold text-white">
          {inr(d.order?.final_amount ?? 0)}
        </span>
      </div>
    </Link>
  );
}
