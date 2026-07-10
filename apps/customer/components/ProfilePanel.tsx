"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getStorageItem } from "@/lib/storage";
import { useLocation, PINCODE_STORAGE_KEY } from "@/store/locationStore";
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
    total: `Rs. ${Number(order.final_amount ?? 0).toLocaleString("en-IN")}`,
    eta: new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

const actionCards = [
  { label: "My Orders", text: "Track try-on deliveries and past purchases.", href: "/orders" },
  { label: "Wishlist", text: "Looks saved for your next delivery.", href: "/wishlist" },
  { label: "My Addresses", text: "Manage home and office delivery points.", href: "#addresses" },
  { label: "AI Style Preferences", text: "Tune fit, undertone, brands, and sizes.", href: "/ai-style-setup" },
  { label: "Try Timer / Active Try-On", text: "Watch your keep-or-return window.", href: "/try-timer" },
  { label: "Payment Methods", text: "Cards, UPI, wallets, and pay-later.", href: "#security" },
  { label: "Coupons & Rewards", text: "View available credits and vouchers.", href: "#rewards" },
  { label: "Refer a Friend", text: "Share Fitzo and earn try-on credits.", href: "#rewards" },
  { label: "Help & Support", text: "Get order, return, and sizing support.", href: "/contact" },
  { label: "Privacy & Security", text: "Password, sessions, and account controls.", href: "#security" },
  { label: "Notifications", text: "Delivery, offers, and style alerts.", href: "/notifications" },
];

const emptyUser: UserProfile = { name: "", email: "", phone: "", membership: "Fitzo Muse" };
const emptyAddress: Address = { id: "", label: "Home", name: "", line: "", city: "", pincode: "", isDefault: false };

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function ProfilePanel() {
  const router = useRouter();
  const { setPincode: setGlobalPincode } = useLocation();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
  }, []);

  useEffect(() => {
    const storedPincode = getStorageItem(PINCODE_STORAGE_KEY);
    if (storedPincode) setPincode(storedPincode); // local display only

    const supabase = createClient();

    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setIsLoggedIn(false);
        setLoading(false);
        router.push("/login");
        return;
      }

      setIsLoggedIn(true);
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
      setIsLoggedIn(false);
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
      <section className="bg-[#f4f1ea] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="h-[400px] animate-pulse rounded-[32px] bg-[#ece3d9]" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f4f1ea] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      {toast ? (
        <div className="fixed right-5 top-24 z-50 rounded-full border border-[#e4d7c8] bg-white px-5 py-3 text-[13px] font-semibold text-[#221b13] shadow-[0_18px_50px_rgba(23,23,23,0.12)]">
          {toast}
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[32px] border border-[#eadfd4] bg-[#fffdf9] shadow-[0_28px_80px_rgba(31,25,18,0.1)]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-[#221b13] p-6 text-white sm:p-8 lg:p-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
                Account overview
              </p>
              <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-white/35 bg-white/15 font-display text-[38px] shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
                  {initials}
                </div>
                <div>
                  <h1 className="font-display text-[44px] leading-none tracking-[-0.04em] sm:text-[58px]">
                    {user.name || user.email}
                  </h1>
                  <div className="mt-5 flex flex-wrap gap-3 text-[13px] text-white/78">
                    {user.phone ? <span>{user.phone}</span> : null}
                    {user.phone && user.email ? <span className="hidden text-white/35 sm:inline">/</span> : null}
                    <span>{user.email}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[#f5d75c] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#221b13]">
                      {user.membership}
                    </span>
                    <span className="rounded-full border border-white/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/72">
                      {isLoggedIn ? "Logged in" : "Demo profile preview"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={openProfileModal}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#221b13] transition duration-200 hover:-translate-y-0.5"
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("logout")}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/35 px-6 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Logout
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("delete-account")}
                  className="text-left text-[12px] font-semibold text-white/68 underline-offset-4 transition duration-200 hover:text-white hover:underline sm:ml-auto"
                >
                  Delete account
                </button>
              </div>
            </div>

            <div className="grid content-center gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:p-10">
              {[
                ["Active Orders", String(orders.filter((o) => !["Delivered", "Completed", "Cancelled", "Return picked"].includes(o.status)).length)],
                ["Wishlist Items", "—"],
                ["Saved Addresses", String(addresses.length)],
                ["Style Match", "—"],
              ].map(([label, value]) => (
                <article
                  key={label}
                  className="rounded-[22px] border border-[#ece3d9] bg-white p-6 shadow-[0_16px_38px_rgba(34,28,20,0.06)] transition duration-200 hover:-translate-y-1"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b8176]">
                    {label}
                  </p>
                  <p className="mt-4 font-display text-[42px] leading-none tracking-[-0.04em] text-[#171717]">
                    {value}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-8">
            <Panel title="Style Preferences" eyebrow="AI style setup" id="style">
              <div className="space-y-5">
                <PreferenceRow label="Skin tone / undertone" value="Medium warm, golden undertone" />
                <PreferenceRow label="Favorite categories" value="Dresses, denim, shirts, occasionwear" />
                <PreferenceRow label="Preferred sizes" value="M tops, 30 denim, UK 6 footwear" />
                <PreferenceRow label="Preferred brands" value="Zara, H&M, Levi's, Nike" />
              </div>
              <Link
                href="/ai-style-setup"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#221b13] px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
              >
                Update preferences
              </Link>
            </Panel>

            <Panel title="Security" eyebrow="Privacy & login" id="security">
              <div className="space-y-4 text-[14px] text-[#5e574f]">
                <PreferenceRow label="Login method" value="Email, phone OTP, Google" />
                <button
                  type="button"
                  onClick={() => showToast("Password change flow coming soon.")}
                  className="flex w-full items-center justify-between rounded-2xl border border-[#eadfd4] bg-white px-4 py-4 text-left font-semibold text-[#221b13] transition duration-200 hover:-translate-y-0.5 hover:border-[#221b13]"
                >
                  Change password
                  <ChevronRight />
                </button>
                <button
                  type="button"
                  onClick={() => showToast("Session manager coming soon.")}
                  className="flex w-full items-center justify-between rounded-2xl border border-[#eadfd4] bg-white px-4 py-4 text-left font-semibold text-[#221b13] transition duration-200 hover:-translate-y-0.5 hover:border-[#221b13]"
                >
                  Manage sessions
                  <ChevronRight />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("delete-account")}
                  className="text-[13px] font-semibold text-[#9a3c2b] underline-offset-4 hover:underline"
                >
                  Delete account
                </button>
              </div>
            </Panel>
          </div>

          <div className="space-y-8">
            <Panel title="Main Account Actions" eyebrow="Customer dashboard">
              <div className="grid gap-4 sm:grid-cols-2">
                {actionCards.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="group rounded-[22px] border border-[#eadfd4] bg-white p-5 shadow-[0_14px_34px_rgba(34,28,20,0.05)] transition duration-200 hover:-translate-y-1 hover:border-[#221b13] hover:shadow-[0_20px_44px_rgba(34,28,20,0.09)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-[#221b13]">{action.label}</h3>
                        <p className="mt-2 text-[13px] leading-6 text-[#6b6258]">{action.text}</p>
                      </div>
                      <span className="mt-1 rounded-full bg-[#f6f1e8] p-2 text-[#221b13] transition duration-200 group-hover:bg-[#a48d78]">
                        <ChevronRight />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel title="Address Book" eyebrow="Delivery locations" id="addresses">
              <div className="grid gap-4 md:grid-cols-2">
                {addresses.map((address) => (
                  <article
                    key={address.id}
                    className="rounded-[22px] border border-[#eadfd4] bg-white p-5 shadow-[0_14px_34px_rgba(34,28,20,0.05)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#f6f1e8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#221b13]">
                          {address.label}
                        </span>
                        {address.isDefault ? (
                          <span className="rounded-full bg-[#a48d78] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#221b13]">
                            Default
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <h3 className="mt-4 font-semibold text-[#221b13]">{address.name}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#6b6258]">
                      {address.line}, {address.city} - {address.pincode}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openAddressModal(address)}
                        className="rounded-full border border-[#d9ccbd] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteAddressId(address.id)}
                        className="rounded-full border border-[#ead0c7] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a3c2b] transition duration-200 hover:bg-[#fff1ec]"
                      >
                        Delete
                      </button>
                      {!address.isDefault ? (
                        <button
                          type="button"
                          onClick={() => markDefaultAddress(address.id)}
                          className="rounded-full bg-[#221b13] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition duration-200 hover:bg-[#3a2f22]"
                        >
                          Set default
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <button
                type="button"
                onClick={() => openAddressModal()}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#a48d78] px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#221b13] transition duration-200 hover:-translate-y-0.5"
              >
                Add new address
              </button>
            </Panel>

            <Panel title="Order Snapshot" eyebrow="Latest activity">
              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      className="grid gap-4 rounded-[22px] border border-[#eadfd4] bg-white p-5 shadow-[0_14px_34px_rgba(34,28,20,0.05)] md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-semibold text-[#221b13]">{order.id}</h3>
                          <span className="rounded-full bg-[#f6f1e8] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.13em] text-[#7b6f63]">
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-2 text-[13px] leading-6 text-[#6b6258]">
                          {order.items} items / {order.total} / {order.eta}
                        </p>
                      </div>
                      <Link
                        href="/order-tracking"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-[#d9ccbd] px-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
                      >
                        Track
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-[#8b8176]">No orders yet. Start shopping!</p>
              )}
              <Link
                href="/orders"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#221b13] px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
              >
                View all orders
              </Link>
            </Panel>

            <Panel title="Coupons & Rewards" eyebrow="Wallet" id="rewards">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Rs. 0", "try-on credits"],
                  ["0", "active coupons"],
                  ["0 friends", "referred"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-[20px] border border-[#eadfd4] bg-white p-5">
                    <p className="font-display text-[32px] leading-none tracking-[-0.04em] text-[#171717]">
                      {value}
                    </p>
                    <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.13em] text-[#8b8176]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
      </div>

      {isProfileModalOpen ? (
        <Modal title="Edit Profile" onClose={() => setIsProfileModalOpen(false)}>
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
        <Modal title={editingAddressId ? "Edit Address" : "Add Address"} onClose={() => setIsAddressModalOpen(false)}>
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

function Panel({
  title,
  eyebrow,
  children,
  id,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-[28px] border border-[#eadfd4] bg-[#fffdf9] p-5 shadow-[0_24px_60px_rgba(31,25,18,0.07)] sm:p-7"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b8176]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[40px]">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function PreferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfd4] bg-white px-4 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#8b8176]">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-semibold leading-6 text-[#221b13]">{value}</p>
    </div>
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
          <h3 className="font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#ded3c6] bg-white text-[#221b13] transition duration-200 hover:bg-[#f6f1e8]"
            aria-label="Close modal"
          >
            <CloseIcon />
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
