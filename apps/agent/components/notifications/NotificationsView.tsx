"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useAgent } from "@/components/AgentShell";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type RiderNotification,
} from "@/lib/agent-data";
import { ContentWrap, PageHeader, Empty, ErrorCard, Skeleton } from "@/components/ui";
import {
  IconBell,
  IconPackage,
  IconScooter,
  IconWallet,
} from "@/components/icons";

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  order: IconPackage,
  delivery: IconScooter,
  payment: IconWallet,
  promo: IconBell,
  system: IconBell,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationsView() {
  const { rider } = useAgent();
  const [rows, setRows] = useState<RiderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let on = true;
    fetchNotifications(rider.userId).then((r) => {
      if (!on) return;
      setRows(r.rows);
      setLoadError(r.error);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rider.userId, reloadKey]);

  const unread = rows.filter((r) => !r.isRead).length;

  async function open(n: RiderNotification) {
    if (n.isRead) return;
    setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    await markNotificationRead(n.id);
  }

  async function readAll() {
    setRows((prev) => prev.map((x) => ({ ...x, isRead: true })));
    await markAllNotificationsRead(rider.userId);
  }

  return (
    <ContentWrap>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up"}
        action={
          unread > 0 ? (
            <button
              onClick={readAll}
              className="h-10 rounded-full border border-line-strong bg-white px-4 text-[13px] font-semibold text-ink transition hover:bg-cream"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-[76px]" />
          <Skeleton className="h-[76px]" />
          <Skeleton className="h-[76px]" />
        </div>
      ) : loadError ? (
        <ErrorCard onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} />
      ) : rows.length === 0 ? (
        <Empty
          icon={<IconBell size={22} />}
          title="No notifications"
          text="Job assignments and updates will show up here."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => {
            const Icon = ICONS[n.type] ?? IconBell;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={[
                  "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                  n.isRead ? "border-line bg-white" : "border-line-strong bg-accent-pale/60",
                ].join(" ")}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-body">
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-semibold text-ink">{n.title}</p>
                    <span className="shrink-0 text-[12px] text-soft">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-5 text-body">{n.body}</p>
                </div>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warn-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </ContentWrap>
  );
}
