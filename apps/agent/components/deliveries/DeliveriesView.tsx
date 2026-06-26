"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@/components/AgentShell";
import { fetchMyDeliveries, type DeliveryListItem } from "@/lib/deliveries";
import { isActiveDelivery } from "@/components/status";
import { DeliveryCard } from "@/components/DeliveryCard";
import { ContentWrap, PageHeader, Empty } from "@/components/ui";

export function DeliveriesView() {
  const { rider, available } = useAgent();
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetchMyDeliveries(rider.riderId).then((d) => {
      if (!on) return;
      setDeliveries(d);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rider.riderId]);

  const active = deliveries.filter((d) => isActiveDelivery(d.status));
  const newJobs = active.filter((d) => d.status === "assigned");
  const inProgress = active.filter((d) => d.status !== "assigned");

  return (
    <ContentWrap>
      <PageHeader
        title="Deliveries"
        subtitle="Jobs assigned to you. Accept a new job, then follow the steps at the door."
      />

      {loading ? (
        <p className="text-[13px] text-[#7c8aa5]">Loading…</p>
      ) : active.length === 0 ? (
        <Empty
          icon="🛵"
          title="No deliveries right now"
          text={
            available
              ? "When an admin assigns you a job, it shows up here."
              : "You're offline — go online (top of the screen) to receive jobs."
          }
        />
      ) : (
        <div className="space-y-7">
          {newJobs.length > 0 && (
            <Group title={`New · tap to accept (${newJobs.length})`} accent>
              {newJobs.map((d) => <DeliveryCard key={d.id} d={d} />)}
            </Group>
          )}
          {inProgress.length > 0 && (
            <Group title={`In progress (${inProgress.length})`}>
              {inProgress.map((d) => <DeliveryCard key={d.id} d={d} />)}
            </Group>
          )}
        </div>
      )}
    </ContentWrap>
  );
}

function Group({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className={[
          "mb-3 text-[13px] font-semibold uppercase tracking-[0.15em]",
          accent ? "text-[#ffd27f]" : "text-[#7c8aa5]",
        ].join(" ")}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
