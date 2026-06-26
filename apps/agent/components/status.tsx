import type { DeliveryStatus } from "@/lib/deliveries";

const LABELS: Record<DeliveryStatus, string> = {
  assigned: "Assigned",
  accepted: "Accepted",
  picked_up: "Picked up",
  en_route: "En route",
  arrived: "At door",
  completed: "Completed",
  failed: "Failed",
};

const STYLES: Record<DeliveryStatus, string> = {
  assigned: "bg-[#2a2030] text-[#e0a87f]",
  accepted: "bg-[#1e2a45] text-[#9fc0ff]",
  picked_up: "bg-[#1e2a45] text-[#9fc0ff]",
  en_route: "bg-[#1e2a45] text-[#9fc0ff]",
  arrived: "bg-[#322a16] text-[#ffd27f]",
  completed: "bg-[#16322a] text-[#7fe0b0]",
  failed: "bg-[#3a1d1d] text-[#ff9b9b]",
};

export function StatusPill({ status }: { status: DeliveryStatus }) {
  return (
    <span className={["rounded-full px-2.5 py-1 text-[11px] font-semibold", STYLES[status]].join(" ")}>
      {LABELS[status]}
    </span>
  );
}

export function isActiveDelivery(status: DeliveryStatus): boolean {
  return status !== "completed" && status !== "failed";
}
