import { createRazorpayClient } from '@fitxo/razorpay';

// Server-side only — imported exclusively from 'use server' actions. The admin
// panel never opens Razorpay Checkout in the browser, so unlike the customer
// app the key id is NOT NEXT_PUBLIC here; both values stay server-only.
// Same test keys as apps/customer/.env.local (one Razorpay account).
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export const razorpayConfigured = Boolean(keyId && keySecret);

export const razorpay = createRazorpayClient(keyId ?? '', keySecret ?? '');

/**
 * The client rejects with RazorpayError, which extends Error AND carries
 * { statusCode, error: { description } } — the same shape the old SDK rejected
 * with, so this unwrapping (and every call site that branches on it) is
 * unchanged.
 */
export function razorpayErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const err = e as { error?: { description?: string }; statusCode?: number };
    return err.error?.description ?? (err.statusCode ? `HTTP ${err.statusCode}` : 'Unknown Razorpay error');
  }
  return 'Unknown Razorpay error';
}
