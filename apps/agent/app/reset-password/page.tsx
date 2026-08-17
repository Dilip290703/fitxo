"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitxo/supabase/client";
import { Banner, btnPrimary, inputCls } from "@/components/ui";

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
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] space-y-4 rounded-3xl border border-line bg-white p-6 shadow-float"
      >
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Set a new password</h1>
        {done ? (
          <Banner kind="ok">Password updated — taking you in…</Banner>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-body">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputCls}
                placeholder="••••••••"
              />
            </label>
            {error && <Banner kind="err">{error}</Banner>}
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "…" : "Update password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
