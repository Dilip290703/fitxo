import Link from "next/link";
import { StatusPill } from "@/components/status";
import type { DeliveryListItem } from "@/lib/deliveries";
import { inr } from "@/components/ui";
import { IconChevronRight, IconMapPin } from "@/components/icons";

export function DeliveryCard({ d }: { d: DeliveryListItem }) {
  const addr = d.drop_address;
  const place = [addr.line1, addr.city, addr.pincode].filter(Boolean).join(", ");
  return (
    <Link
      href={`/deliveries/${d.id}`}
      className="block rounded-2xl border border-line bg-white p-4 transition hover:border-line-strong hover:shadow-float"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[14px] font-semibold text-ink">
          {d.order?.order_number ?? "Order"}
        </p>
        <StatusPill status={d.status} />
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-[14px] text-body">
        <IconMapPin size={15} className="mt-0.5 shrink-0 text-muted" />
        <span>{place || "Address on file"}</span>
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
        <span className="text-[13px] text-soft">
          {addr.full_name ? `For ${addr.full_name}` : "Customer"}
        </span>
        <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
          Order value {inr(d.order?.final_amount ?? 0)}
          <IconChevronRight size={14} className="text-muted" />
        </span>
      </div>
    </Link>
  );
}
