"use client";

import { useEffect, useState } from "react";
import { loadStaff, type StaffMember } from "@/lib/storeSettings";

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function StaffView({ storeId, currentUserId }: { storeId: string; currentUserId: string }) {
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
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Staff</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Staff management
        </h1>
        <p className="mt-1 text-[13px] text-[#958675]">
          Everyone with manager access to this store.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : null}

      <div className={`mt-6 overflow-hidden rounded-2xl border border-[#ece5da] bg-white ${error ? "hidden" : ""}`}>
        {!staff ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#f4efe7]" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-[#f0ebe3]">
            {staff.map((s) => (
              <li key={s.userId} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#171d2b] text-[14px] font-semibold text-white">
                  {(s.name ?? s.email).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[#171d2b]">
                    {s.name ?? s.email}
                    {s.userId === currentUserId ? (
                      <span className="ml-2 rounded-full bg-[#ffd233]/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7a6712]">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[12px] text-[#958675]">{s.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      s.isActive ? "bg-[#e8f3ea] text-[#2f7d46]" : "bg-[#f0ebe3] text-[#8a8073]"
                    }`}
                  >
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                  <p className="mt-1 text-[11px] text-[#a79e92]">Since {formatDate(s.assignedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 rounded-2xl bg-[#f6f1e8] px-5 py-4 text-[12px] leading-6 text-[#6a6259]">
        Staff accounts are provisioned by the Fitzo team — to add or remove a manager,
        contact admin with their name and email. Self-serve invites are on the roadmap.
      </p>
    </div>
  );
}
