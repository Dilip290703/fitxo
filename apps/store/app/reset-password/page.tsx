"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitxo/supabase/client";

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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/"), 1200);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] space-y-4 rounded-2xl border border-line bg-white p-7"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Store access</p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">Set a new password</h1>
        </div>

        {done ? (
          <p className="rounded-xl border border-success-line bg-success-bg px-4 py-3 text-[13px] font-medium text-success">
            Password updated — taking you in…
          </p>
        ) : (
          <>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-soft">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-[15px] text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-accent/25"
                placeholder="••••••••"
              />
            </label>
            {error && (
              <p className="rounded-xl border border-danger-line bg-danger-bg px-4 py-3 text-[13px] font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-full bg-ink text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-ink-soft disabled:opacity-70"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
