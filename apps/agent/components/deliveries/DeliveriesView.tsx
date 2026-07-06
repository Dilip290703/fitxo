"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@/components/AgentShell";
import { fetchMyDeliveries, type DeliveryListItem } from "@/lib/deliveries";
import { isActiveDelivery } from "@/components/status";
import { DeliveryCard } from "@/components/DeliveryCard";
import { ContentWrap, PageHeader, Empty, Skeleton } from "@/components/ui";
import { IconScooter } from "@/components/icons";

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
        subtitle="Your current jobs. Accept an offer, then follow the steps at the door."
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
        </div>
      ) : active.length === 0 ? (
        <Empty
          icon={<IconScooter size={22} />}
          title="No deliveries right now"
          text={
            available
              ? "You're online — new delivery offers pop up on screen the moment a store confirms an order."
              : "You're offline — go online (top of the screen) to receive offers."
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
          "mb-3 text-[13px] font-semibold uppercase tracking-[0.12em]",
          accent ? "text-warn" : "text-muted",
        ].join(" ")}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
