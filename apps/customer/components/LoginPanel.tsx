"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";

type AuthMode = "login" | "signup";

type LoginForm = {
  contact: string;
  password: string;
};

type SignupForm = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

type LoginErrors = Partial<Record<keyof LoginForm, string>>;
type SignupErrors = Partial<Record<keyof SignupForm, string>>;

const editorialImage =
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1400&q=85";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string) {
  return /^\+?\d[\d\s-]{8,}$/.test(value);
}

function GoogleMark() {
  return (
    <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-white text-[15px] font-bold shadow-[inset_0_0_0_1px_rgba(20,20,20,0.08)]">
      <span className="bg-[linear-gradient(90deg,#4285f4,#34a853,#fbbc05,#ea4335)] bg-clip-text text-transparent">
        G
      </span>
    </span>
  );
}

export function LoginPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginForm, setLoginForm] = useState<LoginForm>({
    contact: "",
    password: "",
  });
  const [signupForm, setSignupForm] = useState<SignupForm>({
    name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  const [toast, setToast] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpPending, setOtpPending] = useState(false);
  const [otpToken, setOtpToken] = useState("");

  const contactLooksLikeEmail = useMemo(
    () => loginForm.contact.includes("@"),
    [loginForm.contact],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const validateLogin = () => {
    const nextErrors: LoginErrors = {};
    const contact = loginForm.contact.trim();

    if (!contact) {
      nextErrors.contact = "Enter your phone number or email.";
    } else if (!isEmail(contact) && !isPhone(contact)) {
      nextErrors.contact = "Use a valid email or mobile number.";
    }

    if (contactLooksLikeEmail && !loginForm.password.trim()) {
      nextErrors.password = "Enter your password.";
    }

    setLoginErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateSignup = () => {
    const nextErrors: SignupErrors = {};

    if (!signupForm.name.trim()) nextErrors.name = "Enter your full name.";
    if (!isPhone(signupForm.phone.trim())) nextErrors.phone = "Enter a valid mobile number.";
    if (!isEmail(signupForm.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (signupForm.password.trim().length < 6) {
      nextErrors.password = "Use at least 6 characters.";
    }

    setSignupErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateLogin()) return;

    const contact = loginForm.contact.trim();
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (contactLooksLikeEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: contact,
          password: loginForm.password.trim(),
        });
        if (error) {
          showToast(error.message);
          return;
        }
        showToast("Logged in successfully.");
        window.setTimeout(() => router.push("/profile"), 500);
      } else {
        // Phone OTP
        const phone = contact.replace(/[\s-]/g, "");
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) {
          showToast(error.message);
          return;
        }
        setOtpPending(true);
        showToast("OTP sent to your phone.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otpToken.trim()) return;

    const phone = loginForm.contact.trim().replace(/[\s-]/g, "");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otpToken.trim(),
        type: "sms",
      });
      if (error) {
        showToast(error.message);
        return;
      }
      if (data.user) {
        await supabase.from("users").upsert(
          {
            id: data.user.id,
            email: data.user.email ?? "",
            phone: data.user.phone ?? phone,
            role: "customer",
            preferred_sizes: {},
            is_active: true,
            is_blocked: false,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      }
      showToast("Phone verified. Welcome!");
      window.setTimeout(() => router.push("/profile"), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateSignup()) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email.trim(),
        password: signupForm.password.trim(),
        options: {
          data: { name: signupForm.name.trim(), phone: signupForm.phone.trim() },
        },
      });
      if (error) {
        showToast(error.message);
        return;
      }
      if (data.user) {
        await supabase.from("users").upsert(
          {
            id: data.user.id,
            email: signupForm.email.trim(),
            name: signupForm.name.trim(),
            phone: signupForm.phone.trim(),
            role: "customer",
            preferred_sizes: {},
            is_active: true,
            is_blocked: false,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      }
      if (data.session) {
        showToast("Account created successfully.");
        window.setTimeout(() => router.push("/profile"), 500);
      } else {
        showToast("Account created. Check your email to confirm your account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      showToast(error.message);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-88px)] w-full bg-[#f8f6f3] px-0 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      {toast ? (
        <div className="fixed right-5 top-24 z-50 rounded-full border border-[#e4d7c8] bg-white px-5 py-3 text-[13px] font-semibold text-[#1f2a3c] shadow-[0_18px_50px_rgba(23,23,23,0.12)]">
          {toast}
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-[1480px] bg-white shadow-[0_34px_100px_rgba(32,26,19,0.12)] sm:rounded-[2rem] sm:border sm:border-white lg:h-[calc(100vh-140px)] lg:min-h-[560px] lg:grid-cols-[1fr_1fr]">
        <div className="relative h-64 overflow-hidden bg-[#111827] p-5 text-white sm:h-80 sm:rounded-t-[2rem] sm:p-7 lg:h-full lg:min-h-0 lg:rounded-l-[2rem] lg:rounded-tr-none">
          <Image
            src={editorialImage}
            alt="Editorial fashion look for Fitzo"
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,18,30,0.14),rgba(10,13,20,0.74))]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="font-serif text-[24px] font-semibold tracking-[0.18em]">
                FITZO
              </p>
              <span className="rounded-full border border-white/45 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                60 min try-on
              </span>
            </div>

            <div className="max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffe36a]">
                Fashion at your doorstep
              </p>
              <h1 className="mt-3 font-display text-[34px] leading-[0.92] tracking-[-0.04em] sm:text-[48px] xl:text-[54px]">
                Your fitting room, delivered.
              </h1>
              <p className="mt-4 max-w-sm text-[14px] leading-6 text-white/82 sm:text-[15px] sm:leading-7">
                Save sizes, sync wishlists, track try-at-home orders, and get style picks tuned to your wardrobe.
              </p>
            </div>

            <div className="hidden gap-3 rounded-[24px] border border-white/18 bg-white/12 p-4 backdrop-blur sm:grid sm:grid-cols-3">
              {[
                ["4.9/5", "early rating"],
                ["25k+", "looks styled"],
                ["Pay later", "keep only favorites"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-[25px] leading-none">{value}</p>
                  <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.14em] text-white/72">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center bg-[#fffdf9] px-5 py-7 sm:rounded-b-[2rem] sm:px-8 sm:py-8 lg:h-full lg:overflow-y-auto lg:rounded-bl-none lg:rounded-r-[2rem] lg:px-12 lg:py-8 xl:px-14">
          <div className="w-full max-w-[500px]">
            <div className="text-center">
              <LinkLikeLogo />
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
                Account access
              </p>
              <h2 className="mt-3 font-display text-[38px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[44px]">
                {mode === "login" ? "Welcome back" : "Start your Fitzo closet"}
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-[14px] leading-6 text-[#625b53]">
                {mode === "login"
                  ? "Sign in to manage orders, wishlists, addresses, and your AI style profile."
                  : "Create your account and start your try-at-home shopping experience."}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-full bg-[#f0ebe4] p-1">
              {(["login", "signup"] as AuthMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setMode(item); setOtpPending(false); setOtpToken(""); }}
                  className={`h-11 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] transition duration-200 ${
                    mode === item
                      ? "bg-[#1f2a3c] text-white shadow-[0_10px_22px_rgba(31,42,60,0.18)]"
                      : "text-[#6b6258] hover:text-[#1f2a3c]"
                  }`}
                >
                  {item === "login" ? "Login" : "Signup"}
                </button>
              ))}
            </div>

            {mode === "login" ? (
              otpPending ? (
                <form onSubmit={handleOtpVerify} className="mt-5 space-y-3.5" noValidate>
                  <p className="text-[13px] text-[#625b53]">
                    Enter the OTP sent to <strong>{loginForm.contact}</strong>.
                  </p>
                  <Field
                    label="OTP code"
                    value={otpToken}
                    autoComplete="one-time-code"
                    onChange={(value) => setOtpToken(value)}
                  />
                  <PrimaryButton disabled={isSubmitting}>
                    {isSubmitting ? "Verifying..." : "Verify OTP"}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={() => { setOtpPending(false); setOtpToken(""); }}
                    className="block w-full text-center text-[12px] font-semibold text-[#806f5c] hover:text-[#1f2a3c]"
                  >
                    ← Back
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="mt-5 space-y-3.5" noValidate>
                  <Field
                    label="Phone or email"
                    value={loginForm.contact}
                    error={loginErrors.contact}
                    autoComplete="username"
                    onChange={(value) => {
                      setLoginForm((current) => ({ ...current, contact: value }));
                      setLoginErrors((current) => ({ ...current, contact: undefined }));
                    }}
                  />
                  {contactLooksLikeEmail || loginForm.contact.trim() === "" ? (
                    <Field
                      label="Password"
                      type="password"
                      value={loginForm.password}
                      error={loginErrors.password}
                      autoComplete="current-password"
                      onChange={(value) => {
                        setLoginForm((current) => ({ ...current, password: value }));
                        setLoginErrors((current) => ({ ...current, password: undefined }));
                      }}
                    />
                  ) : null}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-[#806f5c] transition duration-200 hover:text-[#1f2a3c]"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PrimaryButton disabled={isSubmitting}>
                    {isSubmitting ? "Please wait..." : contactLooksLikeEmail ? "Login" : "Get OTP"}
                  </PrimaryButton>
                </form>
              )
            ) : (
              <form onSubmit={handleSignup} className="mt-5 space-y-3.5" noValidate>
                <Field
                  label="Full name"
                  value={signupForm.name}
                  error={signupErrors.name}
                  autoComplete="name"
                  onChange={(value) => {
                    setSignupForm((current) => ({ ...current, name: value }));
                    setSignupErrors((current) => ({ ...current, name: undefined }));
                  }}
                />
                <Field
                  label="Phone"
                  value={signupForm.phone}
                  error={signupErrors.phone}
                  autoComplete="tel"
                  onChange={(value) => {
                    setSignupForm((current) => ({ ...current, phone: value }));
                    setSignupErrors((current) => ({ ...current, phone: undefined }));
                  }}
                />
                <Field
                  label="Email"
                  type="email"
                  value={signupForm.email}
                  error={signupErrors.email}
                  autoComplete="email"
                  onChange={(value) => {
                    setSignupForm((current) => ({ ...current, email: value }));
                    setSignupErrors((current) => ({ ...current, email: undefined }));
                  }}
                />
                <Field
                  label="Password"
                  type="password"
                  value={signupForm.password}
                  error={signupErrors.password}
                  autoComplete="new-password"
                  onChange={(value) => {
                    setSignupForm((current) => ({ ...current, password: value }));
                    setSignupErrors((current) => ({ ...current, password: undefined }));
                  }}
                />
                <PrimaryButton disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create account"}
                </PrimaryButton>
              </form>
            )}

            <div className="my-4 flex items-center gap-4 text-[12px] text-[#9b9186]">
              <span className="h-px flex-1 bg-[#e5ddd2]" />
              <span>or</span>
              <span className="h-px flex-1 bg-[#e5ddd2]" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#ded3c6] bg-white text-[13px] font-semibold text-[#1f2a3c] transition duration-200 hover:-translate-y-0.5 hover:border-[#1f2a3c] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>Continue with Google</span>
              <GoogleMark />
            </button>

            <p className="mt-5 text-center text-[13px] text-[#6d655d]">
              {mode === "login" ? "Do not have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="font-semibold text-[#1f2a3c] underline-offset-4 hover:underline"
              >
                {mode === "login" ? "Sign up" : "Login"}
              </button>
            </p>

            <p className="mt-5 rounded-2xl bg-[#f6f1e8] px-4 py-3 text-center text-[12px] leading-6 text-[#6a6259]">
              Secure login with Supabase Auth. Your data is protected and private.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LinkLikeLogo() {
  return (
    <div className="mx-auto inline-flex h-11 items-center justify-center rounded-full border border-[#e3d8ca] bg-white px-6 font-serif text-[21px] font-semibold tracking-[0.18em] text-[#151b28] shadow-[0_12px_30px_rgba(30,24,18,0.06)]">
      FITZO
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-[#7f7469]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className={`h-12 w-full rounded-2xl border bg-white px-4 text-[15px] text-[#1f2a3c] outline-none transition duration-200 placeholder:text-[#aaa197] focus:border-[#1f2a3c] focus:ring-4 focus:ring-[#ffd233]/20 ${
          error ? "border-[#c4492d]" : "border-[#ded3c6]"
        }`}
      />
      {error ? <span className="mt-2 block text-[12px] font-semibold text-[#b83c24]">{error}</span> : null}
    </label>
  );
}

function PrimaryButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="button-shadow h-12 w-full rounded-full bg-[#ffd233] text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1f2a3c] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffe04c] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {children}
    </button>
  );
}
