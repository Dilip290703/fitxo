import 'server-only';

import crypto from 'node:crypto';
import { createRazorpayClient } from '@fitxo/razorpay';

// Razorpay credentials. Key ID is also exposed to the browser (NEXT_PUBLIC_),
// the secret is server-only and must never be sent to the client.
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  // Surfaced at first use rather than build time so the rest of the app still runs.
  console.warn('[razorpay] Missing NEXT_PUBLIC_RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET');
}

export const razorpay = createRazorpayClient(keyId ?? '', keySecret ?? '');

export const RAZORPAY_KEY_ID = keyId ?? '';

/**
 * Verify the signature Razorpay returns to the browser after a successful
 * checkout: HMAC_SHA256(order_id|payment_id) keyed by the secret, hex-encoded.
 * Constant-time comparison to avoid timing leaks.
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  if (!keySecret) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verify a Razorpay WEBHOOK delivery: HMAC_SHA256(raw request body) keyed by
 * the webhook secret (configured in the Razorpay dashboard — a different
 * secret from the key secret above), hex-encoded in the X-Razorpay-Signature
 * header. This is only a fast pre-check: the settle RPC re-verifies the same
 * signature in-DB (migration 039), since the anon key alone must never be
 * enough to settle a payment.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
