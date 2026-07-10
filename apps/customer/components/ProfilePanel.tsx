"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getStorageItem } from "@/lib/storage";
import { useLocation, PINCODE_STORAGE_KEY } from "@/store/locationStore";
import { useWishlist } from "@/store/wishlistStore";
import { createClient } from "@fitzo/supabase/client";

type UserProfile = {
  name: string;
  email: string;
  phone: string;
  membership: string;
};

type Address = {
  id: string;
  label: "Home" | "Office";
  name: string;
  line: string;
  city: string;
  pincode: string;
  isDefault: boolean;
};

type Order = {
  id: string;
  status: string;
  items: number;
  total: string;
  eta: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUIAddress(addr: any): Address {
  return {
    id: addr.id,
    label: addr.label === "Office" ? "Office" : "Home",
    name: addr.full_name ?? "",
    line: addr.line2 ? `${addr.line1}, ${addr.line2}` : (addr.line1 ?? ""),
    city: addr.city ?? "",
    pincode: addr.pincode ?? "",
    isDefault: addr.is_default ?? false,
  };
}

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
function toUIOrder(order: any): Order {
  return {
    id: order.order_number ?? order.id,
    status: formatOrderStatus(order.status ?? ""),
    items: Array.isArray(order.order_items) ? order.order_items.length : 0,
    total: `₹${Number(order.final_amount ?? 0).toLocaleString("en-IN")}`,
    eta: new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

const emptyUser: UserProfile = { name: "", email: "", phone: "", membership: "Fitzo Muse" };
const emptyAddress: Address = { id: "", label: "Home", name: "", line: "", city: "", pincode: "", isDefault: false };

/* ---------------------------------------------------------------- icons */

function Icon({ path, className = "h-[18px] w-[18px]" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  bag: "M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2",
  heart: "M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20z",
  pin: "M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4zM14 6v12",
  bell: "M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a1.8 1.8 0 0 0 3 0",
  help: "M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.4 1-1.4 1.9M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  chevron: "M9 6l6 6-6 6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11",
};

/* ---------------------------------------------------------------- panel */

export function ProfilePanel() {
  const router = useRouter();
  const { setPincode: setGlobalPincode } = useLocation();
  const { count: wishlistCount } = useWishlist();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile>(emptyUser);
  const [profileDraft, setProfileDraft] = useState<UserProfile>(emptyUser);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressDraft, setAddressDraft] = useState<Address>(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pincode, setPincode] = useState("");
  const [toast, setToast] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"logout" | "delete-account" | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const refreshAddresses = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false });
    if (data) {
      const uiAddresses = data.map(toUIAddress);
      setAddresses(uiAddresses);
      const defaultAddr = uiAddresses.find((a) => a.isDefault);
      if (defaultAddr) {
        setGlobalPincode(defaultAddr.pincode); // persists + updates global state
        setPincode(defaultAddr.pincode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const storedPincode = getStorageItem(PINCODE_STORAGE_KEY);
    if (storedPincode) setPincode(storedPincode); // local display only

    const supabase = createClient();

    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        router.push("/login");
        return;
      }

      setAuthUserId(session.user.id);

      const [userRes, ordersRes] = await Promise.all([
        supabase.from("users").select("name, email, phone").eq("id", session.user.id).maybeSingle(),
        supabase
          .from("orders")
          .select("id, order_number, status, final_amount, created_at, order_items(id)")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const userData = userRes.data;
      const profile: UserProfile = {
        name: userData?.name ?? session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "",
        email: userData?.email ?? session.user.email ?? "",
        phone: userData?.phone ?? session.user.phone ?? "",
        membership: "Fitzo Muse",
      };
      setUser(profile);
      setProfileDraft(profile);

      if (ordersRes.data) {
        setOrders(ordersRes.data.map(toUIOrder));
      }

      await refreshAddresses(session.user.id);
      setLoading(false);
    };

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, refreshAddresses]);

  const firstName = useMemo(
    () => (user.name || user.email || "there").split(/[ @]/)[0],
    [user.name, user.email],
  );

  const initials = useMemo(
    () =>
      (user.name || user.email || "?")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [user.name, user.email],
  );

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) => !["Delivered", "Completed", "Cancelled", "Return picked"].includes(o.status),
      ).length,
    [orders],
  );

  const openProfileModal = () => {
    setProfileDraft(user);
    setIsProfileModalOpen(true);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUserId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ name: profileDraft.name, phone: profileDraft.phone })
      .eq("id", authUserId);
    if (error) {
      showToast("Failed to save profile.");
      return;
    }
    setUser(profileDraft);
    setIsProfileModalOpen(false);
    showToast("Profile changes saved.");
  };

  const openAddressModal = (address?: Address) => {
    if (address) {
      setEditingAddressId(address.id);
      setAddressDraft(address);
    } else {
      setEditingAddressId(null);
      setAddressDraft({
        id: "",
        label: "Home",
        name: user.name,
        line: "",
        city: "",
        pincode,
        isDefault: addresses.length === 0,
      });
    }
    setIsAddressModalOpen(true);
  };

  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUserId) return;
    const supabase = createClient();

    if (addressDraft.isDefault) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", authUserId);
    }

    if (editingAddressId) {
      await supabase
        .from("addresses")
        .update({
          label: addressDraft.label,
          full_name: addressDraft.name,
          line1: addressDraft.line,
          city: addressDraft.city,
          pincode: addressDraft.pincode,
          is_default: addressDraft.isDefault,
        })
        .eq("id", editingAddressId);
    } else {
      await supabase.from("addresses").insert({
        user_id: authUserId,
        label: addressDraft.label,
        full_name: addressDraft.name,
        phone: user.phone || "",
        line1: addressDraft.line,
        city: addressDraft.city,
        state: "",
        pincode: addressDraft.pincode,
        is_default: addressDraft.isDefault,
      });
    }

    await refreshAddresses(authUserId);
    setIsAddressModalOpen(false);
    showToast(editingAddressId ? "Address updated." : "Address added.");
  };

  const deleteAddress = async () => {
    if (!deleteAddressId || !authUserId) return;
    const supabase = createClient();
    await supabase.from("addresses").delete().eq("id", deleteAddressId);
    setDeleteAddressId(null);
    await refreshAddresses(authUserId);
    showToast("Address deleted.");
  };

  const markDefaultAddress = async (id: string) => {
    if (!authUserId) return;
    const supabase = createClient();
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", authUserId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    await refreshAddresses(authUserId);
    showToast("Default address updated.");
  };

  const handleConfirmAction = async () => {
    if (confirmAction === "logout") {
      const supabase = createClient();
      await supabase.auth.signOut();
      setConfirmAction(null);
      router.push("/login");
      return;
    }

    if (confirmAction === "delete-account") {
      setConfirmAction(null);
      showToast("Please contact support to delete your account.");
    }
  };

  if (loading) {
    return (
      <section className="bg-[#f4f1ea] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-[160px] animate-pulse rounded-[24px] bg-[#ece3d9]" />
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="h-[360px] animate-pulse rounded-[24px] bg-[#ece3d9]" />
            <div className="h-[360px] animate-pulse rounded-[24px] bg-[#ece3d9]" />
          </div>
        </div>
      </section>
    );
  }

  const menuItems = [
    { label: "My Orders", desc: "Track deliveries & past orders", href: "/orders", icon: ICONS.bag },
    { label: "Wishlist", desc: `${wishlistCount} saved ${wishlistCount === 1 ? "look" : "looks"}`, href: "/wishlist", icon: ICONS.heart },
    { label: "Saved Addresses", desc: `${addresses.length} delivery ${addresses.length === 1 ? "location" : "locations"}`, href: "#addresses", icon: ICONS.pin },
    { label: "Coupons & Rewards", desc: "Credits & vouchers", href: "#rewards", icon: ICONS.ticket },
    { label: "Notifications", desc: "Delivery & offer alerts", href: "/notifications", icon: ICONS.bell },
    { label: "Help & Support", desc: "Orders, returns & sizing", href: "/contact", icon: ICONS.help },
  ];

  // CSS-driven entrance (see .rise-in in globals.css). Robust by construction:
  // `animation-fill-mode: forwards` holds the final state, so a block can never
  // get stranded hidden the way a framer mount animation can under re-renders.
  const delay = (d: number) => ({ animationDelay: `${d}s` }) as React.CSSProperties;

  return (
    <section className="bg-[#f4f1ea] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {toast ? (
        <div className="fixed right-5 top-24 z-50 rounded-full border border-[#e4d7c8] bg-white px-5 py-3 text-[13px] font-semibold text-[#221b13] shadow-[0_18px_50px_rgba(23,23,23,0.12)]">
          {toast}
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl">
        {/* ---------------------------------------------------- header */}
        <header
          style={delay(0)}
          className="rise-in flex flex-col gap-6 rounded-[24px] border border-[#eadfd4] bg-[#fffdf9] p-6 shadow-[0_18px_50px_rgba(31,25,18,0.07)] sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div className="flex items-center gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#221b13] font-display text-[24px] text-[#faf9f6]">
              {initials}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a48d78]">
                My account
              </p>
              <h1 className="mt-1 font-display text-[30px] leading-none tracking-[-0.03em] text-[#171717] sm:text-[36px]">
                Hi, {firstName}
              </h1>
              <p className="mt-2 text-[13px] text-[#6b6258]">
                {[user.phone, user.email].filter(Boolean).join("  ·  ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openProfileModal}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#221b13] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#221b13] transition duration-200 hover:bg-[#221b13] hover:text-[#faf9f6]"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("logout")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#221b13] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf9f6] transition duration-200 hover:bg-[#3a2f22]"
            >
              <Icon path={ICONS.logout} className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        {/* ---------------------------------------------------- quick stats */}
        <div style={delay(0.06)} className="rise-in mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <StatTile label="Active orders" value={String(activeOrders)} href="/orders" />
          <StatTile label="Wishlist" value={String(wishlistCount)} href="/wishlist" />
          <StatTile label="Addresses" value={String(addresses.length)} href="#addresses" />
        </div>

        {/* ---------------------------------------------------- body */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* menu (Snitch-style list) */}
          <aside
            style={delay(0.12)}
            className="rise-in h-fit rounded-[24px] border border-[#eadfd4] bg-[#fffdf9] p-2.5 shadow-[0_18px_50px_rgba(31,25,18,0.06)]"
          >
            <nav className="flex flex-col">
              {menuItems.map((m) => (
                <MenuRow key={m.label} {...m} />
              ))}
            </nav>

            <div className="my-2 h-px bg-[#eadfd4]" />

            <button
              type="button"
              onClick={() => showToast("Password change flow coming soon.")}
              className="group flex w-full items-center gap-3.5 rounded-[16px] px-3.5 py-3 text-left transition duration-200 hover:bg-[#f6f1e8]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f6f1e8] text-[#221b13] transition duration-200 group-hover:bg-white">
                <Icon path={ICONS.lock} />
              </span>
              <span className="flex-1 text-[14px] font-semibold text-[#221b13]">Change password</span>
              <span className="text-[#b8ab9b] transition-transform duration-200 group-hover:translate-x-0.5">
                <Icon path={ICONS.chevron} className="h-4 w-4" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("delete-account")}
              className="flex w-full items-center gap-3.5 rounded-[16px] px-3.5 py-3 text-left text-[13px] font-semibold text-[#9a3c2b] transition duration-200 hover:bg-[#fff1ec]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fbeae4] text-[#9a3c2b]">
                <Icon path="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13h10l1-13" />
              </span>
              Delete account
            </button>
          </aside>

          {/* content */}
          <div className="space-y-6">
            {/* recent orders */}
            <section
              style={delay(0.18)}
              className="rise-in rounded-[24px] border border-[#eadfd4] bg-[#fffdf9] p-5 shadow-[0_18px_50px_rgba(31,25,18,0.06)] sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[22px] leading-none tracking-[-0.02em] text-[#171717] sm:text-[24px]">
                  Recent orders
                </h2>
                <Link
                  href="/orders"
                  className="text-[12px] font-semibold text-[#a48d78] transition hover:text-[#221b13]"
                >
                  View all
                </Link>
              </div>

              {orders.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#eadfd4] bg-white px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-[#221b13]">{order.id}</span>
                          <span className="rounded-full bg-[#f6f1e8] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#7b6f63]">
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#6b6258]">
                          {order.items} {order.items === 1 ? "item" : "items"} · {order.total} · {order.eta}
                        </p>
                      </div>
                      <Link
                        href="/orders"
                        className="inline-flex h-9 items-center justify-center rounded-full border border-[#d9ccbd] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
                      >
                        Track
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[16px] border border-dashed border-[#e0d4c5] bg-white px-5 py-8 text-center">
                  <p className="text-[14px] text-[#8b8176]">No orders yet.</p>
                  <Link
                    href="/products"
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-[#221b13] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf9f6] transition duration-200 hover:bg-[#3a2f22]"
                  >
                    Start shopping
                  </Link>
                </div>
              )}
            </section>

            {/* address book */}
            <section
              style={delay(0.24)}
              id="addresses"
              className="rise-in scroll-mt-28 rounded-[24px] border border-[#eadfd4] bg-[#fffdf9] p-5 shadow-[0_18px_50px_rgba(31,25,18,0.06)] sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[22px] leading-none tracking-[-0.02em] text-[#171717] sm:text-[24px]">
                  Saved addresses
                </h2>
                <button
                  type="button"
                  onClick={() => openAddressModal()}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[#a48d78] px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#221b13] transition duration-200 hover:bg-[#cbb9a4]"
                >
                  + Add
                </button>
              </div>

              {addresses.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {addresses.map((address) => (
                    <article
                      key={address.id}
                      className="rounded-[16px] border border-[#eadfd4] bg-white p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#f6f1e8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#221b13]">
                          {address.label}
                        </span>
                        {address.isDefault ? (
                          <span className="rounded-full bg-[#a48d78] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#221b13]">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-[14px] font-semibold text-[#221b13]">{address.name}</h3>
                      <p className="mt-1 text-[12px] leading-5 text-[#6b6258]">
                        {address.line}, {address.city} - {address.pincode}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openAddressModal(address)}
                          className="rounded-full border border-[#d9ccbd] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteAddressId(address.id)}
                          className="rounded-full border border-[#ead0c7] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a3c2b] transition duration-200 hover:bg-[#fff1ec]"
                        >
                          Delete
                        </button>
                        {!address.isDefault ? (
                          <button
                            type="button"
                            onClick={() => markDefaultAddress(address.id)}
                            className="rounded-full bg-[#221b13] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition duration-200 hover:bg-[#3a2f22]"
                          >
                            Set default
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-[16px] border border-dashed border-[#e0d4c5] bg-white px-5 py-6 text-center text-[13px] text-[#8b8176]">
                  No addresses saved yet.
                </p>
              )}
            </section>

            {/* coupons & rewards */}
            <section
              style={delay(0.3)}
              id="rewards"
              className="rise-in scroll-mt-28 rounded-[24px] border border-[#eadfd4] bg-[#fffdf9] p-5 shadow-[0_18px_50px_rgba(31,25,18,0.06)] sm:p-6"
            >
              <h2 className="font-display text-[22px] leading-none tracking-[-0.02em] text-[#171717] sm:text-[24px]">
                Coupons &amp; rewards
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["₹0", "try-on credits"],
                  ["0", "active coupons"],
                  ["0", "friends referred"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-[16px] border border-[#eadfd4] bg-white p-4">
                    <p className="font-display text-[28px] leading-none tracking-[-0.03em] text-[#171717]">
                      {value}
                    </p>
                    <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b8176]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- modals */}
      {isProfileModalOpen ? (
        <Modal title="Edit profile" onClose={() => setIsProfileModalOpen(false)}>
          <form onSubmit={saveProfile} className="space-y-4">
            <Input label="Name" value={profileDraft.name} onChange={(value) => setProfileDraft((current) => ({ ...current, name: value }))} required />
            <Input label="Email" type="email" value={profileDraft.email} onChange={(value) => setProfileDraft((current) => ({ ...current, email: value }))} required />
            <Input label="Phone" value={profileDraft.phone} onChange={(value) => setProfileDraft((current) => ({ ...current, phone: value }))} required />
            <button className="h-12 w-full rounded-full bg-[#221b13] text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:bg-[#3a2f22]">
              Save changes
            </button>
          </form>
        </Modal>
      ) : null}

      {isAddressModalOpen ? (
        <Modal title={editingAddressId ? "Edit address" : "Add address"} onClose={() => setIsAddressModalOpen(false)}>
          <form onSubmit={saveAddress} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(["Home", "Office"] as Address["label"][]).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAddressDraft((current) => ({ ...current, label }))}
                  className={`h-11 rounded-full text-[11px] font-semibold uppercase tracking-[0.13em] transition duration-200 ${
                    addressDraft.label === label
                      ? "bg-[#221b13] text-white"
                      : "border border-[#ded3c6] bg-white text-[#221b13]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input label="Receiver name" value={addressDraft.name} onChange={(value) => setAddressDraft((current) => ({ ...current, name: value }))} required />
            <Input label="Address line" value={addressDraft.line} onChange={(value) => setAddressDraft((current) => ({ ...current, line: value }))} required />
            <Input label="City" value={addressDraft.city} onChange={(value) => setAddressDraft((current) => ({ ...current, city: value }))} required />
            <Input label="Pincode" value={addressDraft.pincode} onChange={(value) => setAddressDraft((current) => ({ ...current, pincode: value }))} required />
            <label className="flex items-center gap-3 rounded-2xl border border-[#eadfd4] bg-white px-4 py-3 text-[13px] font-semibold text-[#221b13]">
              <input
                type="checkbox"
                checked={addressDraft.isDefault}
                onChange={(event) => setAddressDraft((current) => ({ ...current, isDefault: event.target.checked }))}
                className="h-4 w-4 accent-[#221b13]"
              />
              Mark as default address
            </label>
            <button className="h-12 w-full rounded-full bg-[#a48d78] text-[11px] font-semibold uppercase tracking-[0.15em] text-[#221b13] transition duration-200 hover:bg-[#cbb9a4]">
              Save address
            </button>
          </form>
        </Modal>
      ) : null}

      {deleteAddressId ? (
        <ConfirmModal
          title="Delete address?"
          text="This saved delivery location will be removed from your address book."
          confirmLabel="Delete"
          onCancel={() => setDeleteAddressId(null)}
          onConfirm={deleteAddress}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmModal
          title={confirmAction === "logout" ? "Logout now?" : "Delete account?"}
          text={
            confirmAction === "logout"
              ? "Your session will end and you will return to login."
              : "Please contact support to permanently delete your account."
          }
          confirmLabel={confirmAction === "logout" ? "Logout" : "Contact support"}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- pieces */

function StatTile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="group rounded-[18px] border border-[#eadfd4] bg-[#fffdf9] p-4 text-center shadow-[0_12px_34px_rgba(34,28,20,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbb9a4] sm:p-5"
    >
      <p className="font-display text-[30px] leading-none tracking-[-0.03em] text-[#171717] sm:text-[36px]">
        {value}
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8176] transition group-hover:text-[#a48d78]">
        {label}
      </p>
    </Link>
  );
}

function MenuRow({ label, desc, href, icon }: { label: string; desc: string; href: string; icon: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-[16px] px-3.5 py-3 transition duration-200 hover:bg-[#f6f1e8]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f6f1e8] text-[#221b13] transition duration-200 group-hover:bg-white group-hover:text-[#a48d78]">
        <Icon path={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-[#221b13]">{label}</span>
        <span className="block truncate text-[12px] text-[#8b8176]">{desc}</span>
      </span>
      <span className="text-[#b8ab9b] transition-transform duration-200 group-hover:translate-x-0.5">
        <Icon path={ICONS.chevron} className="h-4 w-4" />
      </span>
    </Link>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111827]/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-[#eadfd4] bg-[#fffdf9] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="font-display text-[28px] leading-none tracking-[-0.03em] text-[#171717]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#ded3c6] bg-white text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
            aria-label="Close modal"
          >
            <Icon path="M5 5l14 14M19 5L5 19" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  text,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-[14px] leading-7 text-[#5e574f]">{text}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 flex-1 rounded-full bg-[#221b13] text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:bg-[#3a2f22]"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-full border border-[#d9ccbd] bg-white text-[11px] font-semibold uppercase tracking-[0.15em] text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.13em] text-[#7b7067]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-[#ded3c6] bg-white px-4 text-[15px] text-[#221b13] outline-none transition duration-200 focus:border-[#221b13] focus:ring-4 focus:ring-[#a48d78]/20"
      />
    </label>
  );
}
