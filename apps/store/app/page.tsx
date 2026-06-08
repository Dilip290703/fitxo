"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { getStoreContext, type StoreContext } from "@/lib/store-auth";

// Temporary auth-gated landing. Verifies a store-manager session, then hands
// off to the Store Dashboard (next task), which will replace this stub.
export default function StoreHome() {
  const router = useRouter();
  const [context, setContext] = useState<StoreContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getStoreContext().then((ctx) => {
      if (!active) return;
      if (!ctx) {
        router.replace("/login");
        return;
      }
      setContext(ctx);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading || !context) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">
          Loading…
        </p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-6">
      <div className="w-full max-w-[460px] rounded-2xl border border-[#ece5da] bg-white p-8 text-center shadow-[0_20px_60px_rgba(32,26,19,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          Signed in
        </p>
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-[#171d2b]">
          {context.storeName}
        </h1>
        <p className="mt-2 text-[13px] text-[#625b53]">{context.email}</p>
        <p className="mt-5 rounded-xl bg-[#f6f1e8] px-4 py-3 text-[12px] leading-6 text-[#6a6259]">
          Your dashboard is coming next. For now this confirms your store login
          works end to end.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 h-11 w-full rounded-full border border-[#171d2b] text-[12px] font-semibold uppercase tracking-[0.16em] text-[#171d2b] transition hover:bg-[#171d2b] hover:text-white"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
