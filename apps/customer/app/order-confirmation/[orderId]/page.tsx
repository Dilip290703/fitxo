import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@fitxo/supabase/server";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, final_amount, created_at,
       order_items(id, product_name, color_name, size, price_at_order, image_url),
       try_sessions(deadline_at)`
    )
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) {
    redirect("/orders");
  }

  const items = (order.order_items ?? []) as {
    id: string;
    product_name: string;
    color_name: string;
    size: string;
    price_at_order: number;
    image_url: string | null;
  }[];

  const trySession = Array.isArray(order.try_sessions)
    ? order.try_sessions[0]
    : order.try_sessions;

  const deadline = trySession?.deadline_at
    ? new Date(trySession.deadline_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  // Try-window duration from Admin → System Settings — never hardcoded (A3).
  const { data: settings } = await supabase
    .from("system_settings")
    .select("try_window_minutes")
    .eq("id", 1)
    .maybeSingle();
  const tryWindowMinutes = Number(settings?.try_window_minutes ?? 7);

  // Deduplicate items for display (same product+color+size shown as qty)
  const grouped = items.reduce<
    Record<string, { product_name: string; color_name: string; size: string; price_at_order: number; image_url: string | null; qty: number }>
  >((acc, item) => {
    const key = `${item.product_name}-${item.color_name}-${item.size}`;
    if (acc[key]) {
      acc[key].qty += 1;
    } else {
      acc[key] = { ...item, qty: 1 };
    }
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 sm:px-6">
        {/* Success icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf6ed]">
          <svg
            className="h-8 w-8 text-[#2e7d52]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="mt-6 font-display text-[36px] leading-tight text-[#171717]">
          Order placed!
        </h1>
        <p className="mt-2 text-[15px] text-[#5f5851]">
          Your FitXo try-on order is confirmed.
        </p>

        {/* Order number */}
        <div className="mt-6 rounded-[16px] border border-[#ece4da] bg-white px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
            Order number
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold text-[#171717]">
            {order.order_number}
          </p>
        </div>

        {/* Try window */}
        {deadline && (
          <div className="mt-4 rounded-[16px] bg-[#f4ede4] px-5 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
              Try window at your door
            </p>
            <p className="mt-1 text-[14px] text-[#5f5851]">
              When your rider arrives, you&apos;ll have {tryWindowMinutes} minutes to try
              everything on. Keep what you love and hand the rest straight back — no return
              to schedule.
            </p>
          </div>
        )}

        {/* Items */}
        <div className="mt-6 space-y-3">
          <h2 className="text-[16px] font-medium text-[#171717]">Items</h2>
          {Object.values(grouped).map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-[14px] border border-[#ece4da] bg-white px-4 py-3"
            >
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.product_name}
                  className="h-14 w-14 rounded-[10px] object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#171717]">
                  {item.product_name}
                </p>
                <p className="text-[12px] text-[#8b7058]">
                  {item.color_name} · {item.size}
                  {item.qty > 1 ? ` · Qty ${item.qty}` : ""}
                </p>
              </div>
              <p className="text-[14px] font-medium text-[#171717]">
                ₹{(item.price_at_order * item.qty).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#171d2b] px-5 py-4 text-white">
          <p className="text-[14px] font-medium">Total (if you keep everything)</p>
          <p className="text-[18px] font-semibold">
            ₹{order.final_amount.toLocaleString("en-IN")}
          </p>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/order-tracking/${order.id}`}
            className="flex-1 rounded-[14px] bg-[#171d2b] px-6 py-3 text-center text-[14px] font-medium text-white transition hover:bg-[#2a3345]"
          >
            Track order
          </Link>
          <Link
            href="/products"
            className="flex-1 rounded-[14px] border border-[#ddd4c9] px-6 py-3 text-center text-[14px] font-medium text-[#171717] transition hover:border-[#171d2b]"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
