'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary for every admin screen: a failed fetch shows a
 * retry card instead of a blank page or a crashed layout.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] route error', error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-danger-line bg-white p-6 text-center">
      <p className="text-sm font-semibold text-ink">Something went wrong loading this screen</p>
      <p className="mt-1 text-xs text-muted">
        {error.digest ? `Ref ${error.digest} — ` : ''}usually a blip in the connection to Supabase.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft"
      >
        Try again
      </button>
    </div>
  );
}
