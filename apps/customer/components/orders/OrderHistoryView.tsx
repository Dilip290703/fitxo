"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  items: number;
  total: string;
  date: string;
};

// Mirrors the status labels used in ProfilePanel.
function formatOrderStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "Order placed",
    confirmed: "Confirmed",
    assigned: "Rider assigned",
    out_for_delivery: "Out for try-on",
    delivered: "Delivered",
    try_window_active: "Try-on window open",
    return_requested: "Return requested",
    return_picked: "Return picked",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOrderRow(order: any): OrderRow {
  return {
    id: order.id,
    orderNumber: order.order_number ?? order.id,
    status: formatOrderStatus(order.status ?? ""),
    items: Array.isArray(order.order_items) ? order.order_items.length : 0,
    total: `Rs. ${Number(order.final_amount ?? 0).toLocaleString("en-IN")}`,
    date: new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

export function OrderHistoryView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("orders")
        .select("id, order_number, status, final_amount, created_at, order_items(id)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (queryError) {
        setError("We couldn't load your orders. Please try again.");
        setLoading(false);
        return;
      }

      setOrders((data ?? []).map(toOrderRow));
      setLoading(false);
    };

    load();
  }, [router]);

  return (
    <section className="mx-auto w-full max-w-[1000px] px-5 py-10 sm:px-6 lg:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
        My orders
      </p>
      <h1 className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[42px]">
        Order history
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-6 text-[#625b53]">
        Track active try-ons and revisit past Fitzo deliveries.
      </p>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[104px] animate-pulse rounded-[22px] border border-[#eadfd4] bg-white/60"
              />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-[22px] border border-[#e7b9aa] bg-[#fdf3f0] px-5 py-4 text-[14px] text-[#b83c24]">
            {error}
          </p>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="grid gap-4 rounded-[22px] border border-[#eadfd4] bg-white p-5 shadow-[0_14px_34px_rgba(34,28,20,0.05)] md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-semibold text-[#221b13]">{order.orderNumber}</h2>
                    <span className="rounded-full bg-[#f6f1e8] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.13em] text-[#7b6f63]">
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b6258]">
                    {order.items} {order.items === 1 ? "item" : "items"} / {order.total} / {order.date}
                  </p>
                </div>
                <Link
                  href={`/order-tracking/${order.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[#d9ccbd] px-5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
                >
                  Track order
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-[#eadfd4] bg-white p-10 text-center shadow-[0_14px_34px_rgba(34,28,20,0.05)]">
            <p className="text-[15px] font-semibold text-[#221b13]">No orders yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#6b6258]">
              Your try-on orders will show up here once you place your first one.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#221b13] px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
            >
              Browse products
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
