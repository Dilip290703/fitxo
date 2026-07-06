"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { Banner, btnPrimary, inputCls } from "@/components/ui";

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
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <p className="font-serif text-[13px] font-semibold uppercase tracking-[0.35em] text-muted">Fitzo</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">Delivery Partner</h1>
          <p className="mt-1 text-[14px] text-body">
            {mode === "signin" && "Sign in to start delivering"}
            {mode === "signup" && "Create your rider account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-float"
        >
          {mode === "signup" && (
            <Field label="Full name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className={inputCls}
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
              className={inputCls}
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
                className={inputCls}
                placeholder="••••••••"
              />
            </Field>
          )}

          {error && <Banner kind="err">{error}</Banner>}
          {notice && <Banner kind="ok">{notice}</Banner>}

          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy
              ? "…"
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send reset link"}
          </button>

          <div className="flex items-center justify-between pt-1 text-[13px] text-soft">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
                  className="flex h-11 items-center hover:text-ink"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(null); setNotice(null); }}
                  className="flex h-11 items-center font-semibold text-ink hover:underline"
                >
                  Create account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
                className="flex h-11 items-center hover:text-ink"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-body">{label}</span>
      {children}
    </label>
  );
}
