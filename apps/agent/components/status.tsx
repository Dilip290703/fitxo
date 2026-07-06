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
  assigned: "border-warn-bg bg-warn-bg text-warn",
  accepted: "border-info-bg bg-info-bg text-info",
  picked_up: "border-info-bg bg-info-bg text-info",
  en_route: "border-info-bg bg-info-bg text-info",
  arrived: "border-accent-pale bg-accent-pale text-warn",
  completed: "border-success-line bg-success-bg text-success",
  failed: "border-danger-line bg-danger-bg text-danger",
};

export function StatusPill({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={[
        "rounded-full border px-2.5 py-1 text-[12px] font-semibold",
        STYLES[status],
      ].join(" ")}
    >
      {LABELS[status]}
    </span>
  );
}

export function isActiveDelivery(status: DeliveryStatus): boolean {
  return status !== "completed" && status !== "failed";
}
