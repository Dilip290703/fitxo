'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-ink tracking-tight">Fitzo</h1>
          <p className="text-sm text-muted mt-1">Admin Panel</p>
        </div>

        <div className="bg-white border border-line rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-ink mb-6">Sign in to continue</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-danger-bg border border-danger-line rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-body mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fitzo.com"
                className="w-full bg-white border border-line rounded-xl px-4 py-3 text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-body mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-line rounded-xl px-4 py-3 text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink hover:bg-ink-soft disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-faint mt-6">
          Fitzo Admin · Restricted Access
        </p>
      </div>
    </div>
  );
}
