"use client";

import { useEffect, useState } from "react";
import { loadStaff, type StaffMember } from "@/lib/storeSettings";
import { formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";

export function StaffView() {
  const { storeId, userId: currentUserId } = useStorePanel();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadStaff(storeId)
      .then((rows) => {
        if (active) setStaff(rows);
      })
      .catch(() => {
        if (active) setError("We couldn't load your staff list. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Staff"
        title="Staff management"
        sub="Everyone with manager access to this store."
      />

      {error ? (
        <Banner variant="error" className="mt-6">{error}</Banner>
      ) : null}

      <div className={`mt-6 overflow-hidden rounded-2xl border border-line bg-white ${error ? "hidden" : ""}`}>
        {!staff ? (
          <RowsSkeleton rows={2} />
        ) : (
          <ul className="divide-y divide-hairline">
            {staff.map((s) => (
              <li key={s.userId} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-[14px] font-semibold text-white">
                  {(s.name ?? s.email).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">
                    {s.name ?? s.email}
                    {s.userId === currentUserId ? (
                      <span className="ml-2 rounded-full bg-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-warn">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[12px] text-muted">{s.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge tone={s.isActive ? "green" : "neutral"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                  <p className="mt-1 text-[11px] text-faint">Since {formatDate(s.assignedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 rounded-2xl bg-cream px-5 py-4 text-[12px] leading-6 text-body">
        Staff accounts are provisioned by the Fitzo team — to add or remove a manager,
        contact admin with their name and email. Self-serve invites are on the roadmap.
      </p>
    </div>
  );
}
