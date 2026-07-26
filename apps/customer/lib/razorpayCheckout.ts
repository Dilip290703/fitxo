// Browser-side Razorpay Checkout glue, shared by the two screens that open the
// modal: checkout (the upfront delivery fee) and order tracking (Keep payments,
// plus the fee-retry fallback).
//
// This is a plain module, NOT a component — importing values out of a
// 'use client' file is what breaks SSR at request time, and the `declare global`
// below can only be stated once anyway.
//
// Note: `apps/customer/lib/razorpay.ts` is the SERVER half (it holds the key
// secret and must never be imported from the browser). This file only ever
// touches the public key id that a server action hands back.

export const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};

export type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/** Resolves false when the script can't load (offline, blocked) — never throws. */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
