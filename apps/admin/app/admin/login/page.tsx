'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';

// W3.5: stepped sign-in — credentials → TOTP verify (enrolled admins) or TOTP
// enrollment (when NEXT_PUBLIC_ADMIN_REQUIRE_MFA=true). The layout bounces
// aal1 sessions back here, and the mount effect drops them straight into the
// right step. An allowlist-denied session arrives as ?denied=allowlist and is
// signed out on the spot (breaks the redirect loop by construction).
type Step = 'credentials' | 'verify' | 'enroll';

const MFA_REQUIRED = process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA === 'true';

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** After a valid admin password session: dashboard, verify, or enroll? */
  const routeSession = useCallback(async () => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp ?? [];

    if (verified.length > 0) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') {
        router.push('/admin');
        router.refresh();
        return;
      }
      setFactorId(verified[0].id);
      setStep('verify');
      return;
    }

    if (MFA_REQUIRED) {
      // Clear stale half-finished enrollments, then start a fresh one.
      for (const f of factors?.all ?? []) {
        if (f.factor_type === 'totp' && f.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Fitzo Admin',
      });
      if (enrollError || !data) {
        setError(
          `Couldn't start two-factor setup: ${enrollError?.message ?? 'unknown error'}. ` +
            'Is TOTP enabled under Authentication → MFA in the Supabase dashboard?',
        );
        setStep('credentials');
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setTotpSecret(data.totp.secret);
      setStep('enroll');
      return;
    }

    router.push('/admin');
    router.refresh();
  }, [router, supabase]);

  // Mount: handle allowlist denials and sessions bounced back by the layout.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      if (new URLSearchParams(window.location.search).has('denied')) {
        await supabase.auth.signOut();
        setError('This account is not on the admin allowlist.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin') return;
      await routeSession();
    })();
  }, [routeSession, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication failed');

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin privileges required.');
      }

      await routeSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setLoading(false);
    if (verifyError) {
      setError('That code didn’t work — check your authenticator app and try again.');
      setCode('');
      return;
    }
    router.push('/admin');
    router.refresh();
  };

  const handleUseDifferentAccount = async () => {
    await supabase.auth.signOut();
    setStep('credentials');
    setCode('');
    setError('');
  };

  const inputClass =
    'w-full bg-white border border-line rounded-xl px-4 py-3 text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors';
  const buttonClass =
    'w-full bg-ink hover:bg-ink-soft disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2';

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-ink tracking-tight">Fitzo</h1>
          <p className="text-sm text-muted mt-1">Admin Panel</p>
        </div>

        <div className="bg-white border border-line rounded-2xl p-8">
          {error && (
            <div className="mb-4 px-4 py-3 bg-danger-bg border border-danger-line rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          {step === 'credentials' && (
            <>
              <h2 className="text-lg font-semibold text-ink mb-6">Sign in to continue</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-body mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@fitzo.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-body mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>
                <button type="submit" disabled={loading} className={buttonClass}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {step === 'verify' && (
            <>
              <h2 className="text-lg font-semibold text-ink mb-1">Two-factor check</h2>
              <p className="text-sm text-muted mb-6">
                Enter the 6-digit code from your authenticator app.
              </p>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className={`${inputClass} text-center text-xl font-mono tracking-[0.4em]`}
                />
                <button type="submit" disabled={loading || code.length !== 6} className={buttonClass}>
                  {loading ? 'Checking…' : 'Verify'}
                </button>
              </form>
              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="mt-4 w-full text-center text-xs text-muted hover:text-ink"
              >
                Use a different account
              </button>
            </>
          )}

          {step === 'enroll' && (
            <>
              <h2 className="text-lg font-semibold text-ink mb-1">Set up two-factor</h2>
              <p className="text-sm text-muted mb-4">
                Admin accounts need an authenticator app (Google Authenticator, 1Password, Authy…).
                Scan the code, then enter the 6 digits it shows.
              </p>
              {qrCode ? (
                <div className="mb-4 flex justify-center rounded-xl border border-line bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="Scan this QR code with your authenticator app" className="h-44 w-44" />
                </div>
              ) : null}
              {totpSecret ? (
                <p className="mb-4 break-all text-center text-[11px] text-muted">
                  Can&apos;t scan? Enter this key manually: <span className="font-mono text-ink">{totpSecret}</span>
                </p>
              ) : null}
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className={`${inputClass} text-center text-xl font-mono tracking-[0.4em]`}
                />
                <button type="submit" disabled={loading || code.length !== 6} className={buttonClass}>
                  {loading ? 'Confirming…' : 'Confirm & enter'}
                </button>
              </form>
              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="mt-4 w-full text-center text-xs text-muted hover:text-ink"
              >
                Use a different account
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-faint mt-6">Fitzo Admin · Restricted Access</p>
      </div>
    </div>
  );
}
