"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Supabase establishes a recovery session from the email link, so updateUser works.
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/"), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1522] px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-[400px] space-y-4 rounded-[20px] border border-[#243049] bg-[#161e2e] p-6">
        <h1 className="text-[22px] font-semibold text-white">Set a new password</h1>
        {done ? (
          <p className="rounded-[10px] bg-[#16322a] px-3 py-2 text-[13px] text-[#7fe0b0]">
            Password updated — taking you in…
          </p>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-[#9fb0cc]">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-[12px] border border-[#2c3a55] bg-[#0f1522] px-3.5 py-3 text-[14px] text-white outline-none focus:border-[#3b82f6]"
                placeholder="••••••••"
              />
            </label>
            {error && <p className="rounded-[10px] bg-[#3a1d1d] px-3 py-2 text-[13px] text-[#ff9b9b]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[12px] bg-[#3b82f6] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#2f6fdc] disabled:opacity-60"
            >
              {busy ? "…" : "Update password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
