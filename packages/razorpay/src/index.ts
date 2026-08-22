/**
 * Razorpay REST client — a transport, not payment logic.
 *
 * WHY THIS EXISTS
 * The official `razorpay` npm SDK depends on axios, which needs a full Node
 * runtime. That rules out edge/Worker-style hosts (Cloudflare) and ties the
 * deployment target to whatever the SDK happens to tolerate. These three calls
 * are ordinary HTTPS requests with basic auth, so doing them with `fetch`
 * removes the dependency and works identically on Node, Workers, and anything
 * else with a standard fetch.
 *
 * IMPORTANT: this changes HOW the request is sent, never what is sent. Same
 * endpoints, same payloads, same amounts in paise, same idempotency behaviour.
 * The CLAUDE.md rule "money flows through Razorpay only — never hand-roll
 * payment or payout logic" still holds: no charge, refund or fee is computed
 * here, we only carry the call.
 *
 * Signature verification deliberately lives OUTSIDE this file, in each app's
 * lib/razorpay.ts, and still uses node:crypto — that is the security-critical
 * path and was not worth touching in the same change.
 */

const API_BASE = 'https://api.razorpay.com/v1';

/** Fields we actually read off a created order. */
export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
  notes?: Record<string, string>;
}

/** Fields we actually read off a fetched payment (fee/tax drive order_economics). */
export interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  /** Razorpay's commission, in paise. INCLUDES tax. */
  fee?: number;
  /** The GST portion of `fee`, in paise. */
  tax?: number;
  method?: string;
  notes?: Record<string, string>;
}

export interface RazorpayRefund {
  id: string;
  amount: number;
  status: string;
  payment_id?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderParams {
  /** In paise. Razorpay rejects fractional currency. */
  amount: number;
  currency: string;
  /** Razorpay caps this at 40 characters. */
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RefundParams {
  /** Omit for a full refund — Razorpay's own default. */
  amount?: number;
  notes?: Record<string, string>;
  speed?: 'normal' | 'optimum';
}

/**
 * Mirrors the shape the official SDK rejects with, because call sites already
 * branch on it: they check `e instanceof Error` first and read `e.message`,
 * then fall back to `e.error.description` / `e.statusCode`. Extending Error and
 * ALSO carrying those fields keeps both branches working untouched — including
 * the `/fully refunded/i` test that reconciles an already-refunded payment
 * instead of failing the action.
 */
export class RazorpayError extends Error {
  readonly statusCode: number;
  readonly error: { code?: string; description?: string; reason?: string; step?: string };

  constructor(statusCode: number, body: unknown) {
    const e = (body as { error?: { description?: string } } | null)?.error;
    super(e?.description ?? `HTTP ${statusCode}`);
    this.name = 'RazorpayError';
    this.statusCode = statusCode;
    this.error = (e as RazorpayError['error']) ?? { description: `HTTP ${statusCode}` };
  }
}

function basicAuth(keyId: string, keySecret: string): string {
  const raw = `${keyId}:${keySecret}`;
  // btoa exists on Workers and modern Node; Buffer is the Node-only fallback.
  const b64 =
    typeof btoa === 'function'
      ? btoa(raw)
      : Buffer.from(raw, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

export interface RazorpayClient {
  orders: { create(params: CreateOrderParams): Promise<RazorpayOrder> };
  payments: {
    fetch(paymentId: string): Promise<RazorpayPayment>;
    refund(paymentId: string, params?: RefundParams): Promise<RazorpayRefund>;
  };
}

/**
 * The returned object intentionally mirrors the SDK's call surface
 * (`razorpay.orders.create`, `razorpay.payments.fetch`, `.refund`) so no call
 * site had to change when the SDK was dropped.
 */
export function createRazorpayClient(keyId: string, keySecret: string): RazorpayClient {
  async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: basicAuth(keyId, keySecret),
        'Content-Type': 'application/json',
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });

    // Razorpay answers with JSON on both success and failure, but a gateway
    // error page would not — treat unparseable bodies as an API error rather
    // than throwing a SyntaxError the call sites do not expect.
    let parsed: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) throw new RazorpayError(res.status, parsed);
    return parsed as T;
  }

  return {
    orders: {
      create: (params) => request<RazorpayOrder>('/orders', { method: 'POST', body: params }),
    },
    payments: {
      fetch: (paymentId) => request<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`),
      refund: (paymentId, params = {}) =>
        request<RazorpayRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
          method: 'POST',
          body: params,
        }),
    },
  };
}
