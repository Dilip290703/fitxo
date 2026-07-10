import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { verifyWebhookSignature } from '@/lib/razorpay';

// Razorpay `payment.captured` webhook — the server-to-server settle path.
// The browser success handler (confirmKeepPayment) settles the happy path; this
// route settles when that handler never runs (tab closed, phone died, network
// dropped right after payment). Both funnel into the same in-DB settle core
// (migration 039), which locks the payments row and no-ops on duplicates, so
// the two racing is safe.
//
// Response codes drive Razorpay's retry behavior (it retries non-2xx with
// backoff for up to 24h):
//   2xx → handled or deliberately ignored — stop retrying
//   401 → signature verification failed — a retry won't fix a forgery
//   5xx → not configured / transient DB failure — please retry

// A webhook has no user session or cookies. The RPC authorizes the call by
// re-verifying the webhook signature in-DB — not by the caller's role — so the
// plain anon key is all this client needs.
function anonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function POST(req: Request) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('x-razorpay-signature');
  // The HMAC is over the exact raw bytes — read the body as text, never re-serialize.
  const rawBody = await req.text();

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: { event?: string } | null = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  // Only payment.captured is subscribed; anything else that shows up is acked
  // without touching the DB.
  if (event?.event !== 'payment.captured') {
    return NextResponse.json({ status: 'ignored' });
  }

  const supabase = anonClient();
  const { data, error } = await supabase.rpc('razorpay_webhook_captured', {
    p_payload: rawBody,
    p_signature: signature,
  });

  if (error) {
    // Covers: migration 039 / Vault secret missing, amount mismatch, transient
    // DB failure. 500 → Razorpay retries; persistent failures surface in its
    // dashboard webhook log and ours.
    console.error('[razorpay-webhook] settle failed:', error.message);
    return NextResponse.json({ error: 'settle failed' }, { status: 500 });
  }

  return NextResponse.json({ status: data });
}
