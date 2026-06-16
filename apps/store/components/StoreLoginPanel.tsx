"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { getStoreContext } from "@/lib/store-auth";

export function StoreLoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
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

      // A valid session is not enough — the user must be an active store
      // manager. Customers/riders share this Supabase project, so reject them.
      const context = await getStoreContext();
      if (!context) {
        await supabase.auth.signOut();
        setError("This account isn't registered as a store manager.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#fbfaf7]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1200px] lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#171d2b] p-12 text-white lg:flex">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ffd233]/10 blur-2xl" />
          <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[#ffd233]/10 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <span className="font-serif text-[22px] font-semibold tracking-[0.18em]">
              FITZO
            </span>
            <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Store
            </span>
          </div>

          <div className="relative max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffd233]">
              Store manager panel
            </p>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-[-0.02em]">
              Run your storefront.
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-white/75">
              Manage your catalogue, track try-on orders, handle returns,
              and watch your earnings — all in one place.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            {[
              ["Catalogue", "your products"],
              ["Orders", "try & keep"],
              ["Payouts", "every week"],
            ].map(([title, sub]) => (
              <div key={title}>
                <p className="text-[14px] font-semibold">{title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/55">
                  {sub}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="font-serif text-[20px] font-semibold tracking-[0.18em] text-[#171d2b]">
                FITZO
              </span>
              <span className="rounded-full border border-[#171d2b]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#171d2b]/70">
                Store
              </span>
            </div>

            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675] lg:mt-0">
              Store access
            </p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[#171d2b]">
              Sign in to your store
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-[#625b53]">
              Use the email and password set up for your store account.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-[#7f7469]">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  autoComplete="username"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  className="h-12 w-full rounded-xl border border-[#ded3c6] bg-white px-4 text-[15px] text-[#171d2b] outline-none transition focus:border-[#171d2b] focus:ring-4 focus:ring-[#ffd233]/25"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-[#7f7469]">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  className="h-12 w-full rounded-xl border border-[#ded3c6] bg-white px-4 text-[15px] text-[#171d2b] outline-none transition focus:border-[#171d2b] focus:ring-4 focus:ring-[#ffd233]/25"
                />
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-full bg-[#171d2b] text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1f2a3c] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-6 rounded-xl bg-[#f6f1e8] px-4 py-3 text-center text-[12px] leading-6 text-[#6a6259]">
              Store accounts are created by the Fitzo team. Contact your admin if
              you need access.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
