"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";

type Mode = "signin" | "signup" | "forgot";

export default function AgentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role: "rider" } },
        });
        if (error) throw error;
        setNotice(
          "Account created. A Fitzo admin will verify your rider profile before you can take deliveries.",
        );
        setMode("signin");
        return;
      }

      // forgot
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setNotice("If that email has an account, a password-reset link is on its way.");
      setMode("signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1522] px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#7c8aa5]">Fitzo</p>
          <h1 className="mt-2 text-[28px] font-semibold text-white">Delivery Partner</h1>
          <p className="mt-1 text-[13px] text-[#7c8aa5]">
            {mode === "signin" && "Sign in to start delivering"}
            {mode === "signup" && "Create your rider account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[20px] border border-[#243049] bg-[#161e2e] p-6"
        >
          {mode === "signup" && (
            <Field label="Full name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="agent-input"
                placeholder="Your name"
              />
            </Field>
          )}

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="agent-input"
              placeholder="you@example.com"
            />
          </Field>

          {mode !== "forgot" && (
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="agent-input"
                placeholder="••••••••"
              />
            </Field>
          )}

          {error && (
            <p className="rounded-[10px] bg-[#3a1d1d] px-3 py-2 text-[13px] text-[#ff9b9b]">{error}</p>
          )}
          {notice && (
            <p className="rounded-[10px] bg-[#16322a] px-3 py-2 text-[13px] text-[#7fe0b0]">{notice}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[12px] bg-[#3b82f6] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#2f6fdc] disabled:opacity-60"
          >
            {busy
              ? "…"
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send reset link"}
          </button>

          <div className="flex items-center justify-between pt-1 text-[12px] text-[#7c8aa5]">
            {mode === "signin" ? (
              <>
                <button type="button" onClick={() => { setMode("forgot"); setError(null); setNotice(null); }} className="hover:text-white">
                  Forgot password?
                </button>
                <button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className="hover:text-white">
                  Create account
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="hover:text-white">
                ← Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>

      <style>{`
        .agent-input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid #2c3a55;
          background: #0f1522;
          padding: 12px 14px;
          font-size: 14px;
          color: #fff;
          outline: none;
        }
        .agent-input:focus { border-color: #3b82f6; }
        .agent-input::placeholder { color: #54627d; }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[#9fb0cc]">{label}</span>
      {children}
    </label>
  );
}
