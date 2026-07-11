import Razorpay from 'razorpay';

// Server-side only — imported exclusively from 'use server' actions. The admin
// panel never opens Razorpay Checkout in the browser, so unlike the customer
// app the key id is NOT NEXT_PUBLIC here; both values stay server-only.
// Same test keys as apps/customer/.env.local (one Razorpay account).
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export const razorpayConfigured = Boolean(keyId && keySecret);

export const razorpay = new Razorpay({
  key_id: keyId ?? '',
  key_secret: keySecret ?? '',
});

/**
 * Razorpay's SDK rejects with a plain object ({ statusCode, error: { description } })
 * on API errors — unwrap it to a readable message (same handling as the
 * customer app's createKeepPayment).
 */
export function razorpayErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const err = e as { error?: { description?: string }; statusCode?: number };
    return err.error?.description ?? (err.statusCode ? `HTTP ${err.statusCode}` : 'Unknown Razorpay error');
  }
  return 'Unknown Razorpay error';
}
