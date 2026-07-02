"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { getStoreContext } from "@/lib/store-auth";

type Mode = "signin" | "signup" | "forgot";

const inputClass =
  "h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-[15px] text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-accent/25";
const labelClass =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-soft";

export function StoreLoginPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [storeName, setStoreName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const trimmedEmail = email.trim();
    const supabase = createClient();
    setIsSubmitting(true);

    try {
      if (mode === "forgot") {
        if (!trimmedEmail) {
          setError("Enter your email.");
          return;
        }
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) {
          setError(resetError.message);
          return;
        }
        setNotice("If that email has a store account, a password-reset link is on its way.");
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        if (!storeName.trim() || !name.trim() || !trimmedEmail || !password) {
          setError("Fill in every field to create your store.");
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { name: name.trim(), role: "store_manager", store_name: storeName.trim() } },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // If email confirmation is off, signUp returns a session — jump straight
        // into onboarding. Otherwise ask them to confirm, then sign in.
        if (data.session) {
          router.replace("/onboarding");
          router.refresh();
          return;
        }
        setNotice("Store account created. Check your email to confirm, then sign in to finish setup.");
        setStoreName("");
        setName("");
        setPassword("");
        setMode("signin");
        return;
      }

      // signin
      if (!trimmedEmail || !password) {
        setError("Enter your email and password.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : signInError.message,
        );
        return;
      }

      // A valid session is not enough — the user must be a store manager.
      // Customers/riders share this Supabase project, so reject them.
      const context = await getStoreContext();
      if (!context) {
        await supabase.auth.signOut();
        setError("This account isn't registered as a store manager.");
        return;
      }

      // The guard on the destination routes a not-yet-approved store to /onboarding.
      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const heading =
    mode === "signin" ? "Sign in to your store" : mode === "signup" ? "Sell on Fitzo" : "Reset your password";
  const sub =
    mode === "signin"
      ? "Use the email and password for your store account."
      : mode === "signup"
        ? "Create your seller account and set up your store in minutes."
        : "We'll email you a link to set a new password.";

  return (
    <main className="min-h-screen w-full bg-paper">
      <div className="mx-auto grid min-h-screen w-full max-w-[1200px] lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-2xl" />
          <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-accent/10 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <span className="font-serif text-[22px] font-semibold tracking-[0.18em]">FITZO</span>
            <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Store
            </span>
          </div>

          <div className="relative max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Store manager panel
            </p>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-[-0.02em]">
              Run your storefront.
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-white/75">
              Manage your catalogue, track try-on orders, handle returns, and watch your
              earnings — all in one place.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            {[
              ["Catalogue", "your products"],
              ["Orders", "try & keep"],
              ["Payouts", "every week"],
            ].map(([title, subtitle]) => (
              <div key={title}>
                <p className="text-[14px] font-semibold">{title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/55">{subtitle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="font-serif text-[20px] font-semibold tracking-[0.18em] text-ink">FITZO</span>
              <span className="rounded-full border border-ink/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/70">
                Store
              </span>
            </div>

            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted lg:mt-0">
              {mode === "signup" ? "New seller" : "Store access"}
            </p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {heading}
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-body">{sub}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
              {mode === "signup" && (
                <>
                  <label className="block">
                    <span className={labelClass}>Store name</span>
                    <input
                      value={storeName}
                      autoComplete="organization"
                      onChange={(e) => {
                        setStoreName(e.target.value);
                        setError("");
                      }}
                      className={inputClass}
                      placeholder="e.g. Loom & Co."
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Your name</span>
                    <input
                      value={name}
                      autoComplete="name"
                      onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                      }}
                      className={inputClass}
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className={labelClass}>Email</span>
                <input
                  type="email"
                  value={email}
                  autoComplete="username"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  className={inputClass}
                />
              </label>

              {mode !== "forgot" && (
                <label className="block">
                  <span className={labelClass}>Password</span>
                  <input
                    type="password"
                    value={password}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    className={inputClass}
                  />
                </label>
              )}

              {mode === "signin" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-[12px] font-semibold text-soft underline-offset-4 hover:text-ink hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-danger-line bg-danger-bg px-4 py-3 text-[13px] font-medium text-danger"
                >
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-xl border border-success-line bg-success-bg px-4 py-3 text-[13px] font-medium text-success">
                  {notice}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-full bg-ink text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create store account"
                      : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-[13px] text-body">
              {mode === "signin" ? (
                <>
                  New to Fitzo?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-semibold text-ink underline underline-offset-4"
                  >
                    Create a store account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-semibold text-ink underline underline-offset-4"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
