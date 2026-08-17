"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitxo/supabase/client";

type NotificationRow = {
  id: string;
  type: "order_update" | "promo" | "system";
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

const TYPE_LABEL: Record<NotificationRow["type"], string> = {
  order_update: "Order",
  promo: "Offer",
  system: "System",
};

const TYPE_STYLE: Record<NotificationRow["type"], string> = {
  order_update: "bg-[#e8f5ec] text-[#2e7d52]",
  promo: "bg-[#fff8e6] text-[#9a6f0a]",
  system: "bg-[#f0f0f5] text-[#555]",
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationsView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data, error: err } = await supabase
        .from("notifications")
        .select("id, type, title, body, is_read, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (err) { setError("Couldn't load notifications. Please try again."); setLoading(false); return; }
      setNotifications((data ?? []) as NotificationRow[]);
      setLoading(false);
    };

    load();
  }, [router]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <section className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-6 lg:py-14">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
            Inbox
          </p>
          <h1 className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[42px]">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-[#a48d78] px-2 text-[13px] font-bold text-[#221b13]">
                {unreadCount}
              </span>
            )}
          </h1>
        </div>
        {unreadCount > 0 && !loading && (
          <button
            type="button"
            onClick={markAllRead}
            className="mb-1 text-[12px] font-semibold text-[#221b13] underline-offset-4 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Body */}
      <div className="mt-8">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[90px] animate-pulse rounded-[22px] border border-[#eadfd4] bg-white/60" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-[22px] border border-[#e7b9aa] bg-[#fdf3f0] px-5 py-4 text-[14px] text-[#b83c24]">
            {error}
          </p>
        ) : notifications.length === 0 ? (
          <div className="rounded-[22px] border border-[#eadfd4] bg-white p-10 text-center shadow-[0_14px_34px_rgba(34,28,20,0.05)]">
            <p className="text-[28px]">🔔</p>
            <p className="mt-3 text-[15px] font-semibold text-[#221b13]">All clear</p>
            <p className="mt-2 text-[14px] text-[#6b6258]">
              No notifications yet. Order updates and offers will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={[
                  "relative rounded-[22px] border bg-white px-5 py-4 shadow-[0_14px_34px_rgba(34,28,20,0.04)] transition",
                  n.is_read ? "border-[#eadfd4]" : "border-[#d9ccbd]",
                ].join(" ")}
              >
                {/* Unread dot */}
                {!n.is_read && (
                  <span className="absolute right-5 top-5 h-2 w-2 rounded-full bg-[#a48d78]" />
                )}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${TYPE_STYLE[n.type]}`}>
                        {TYPE_LABEL[n.type]}
                      </span>
                      <span className="text-[11px] text-[#9b8f83]">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className={["mt-2 text-[14px] font-semibold", n.is_read ? "text-[#4a4540]" : "text-[#171717]"].join(" ")}>
                      {n.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[#6b6258]">{n.body}</p>
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="mt-3 text-[11px] font-semibold text-[#8b7058] hover:text-[#221b13]"
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
