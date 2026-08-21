/**
 * A test suite that mutates a shared database owes one more assertion than its
 * own subject: that it left nothing behind.
 *
 * This is not housekeeping. `pending_fee_refunds()` is a DERIVED queue — it
 * infers "order holding money it shouldn't" from payment rows — so a forgotten
 * test payment shows up as a real customer owed a real refund. This project
 * already has one such stuck row on dev; the suite must not add another.
 */
export async function residueSuite(world, report, ctx) {
  const { admin } = world;

  report.heading('residue — the suite leaves the money queues as it found them');

  const { data: pendingNow } = await admin.rpc('pending_fee_refunds');
  const { data: staleNow } = await admin.rpc('stale_offers_needing_refund');

  const beforeFee = ctx.baseline?.pending_fee_refunds ?? 0;
  const beforeStale = ctx.baseline?.stale_offers_needing_refund ?? 0;

  report.check(
    'pending_fee_refunds() is back to its baseline count',
    (pendingNow ?? []).length === beforeFee,
    `${beforeFee} before → ${(pendingNow ?? []).length} after`,
  );
  report.check(
    'stale_offers_needing_refund() is back to its baseline count',
    (staleNow ?? []).length === beforeStale,
    `${beforeStale} before → ${(staleNow ?? []).length} after`,
  );

  const { data: leftoverUsers } = await admin
    .from('users').select('id').like('email', `${world.tag}%`);
  report.check(
    'no test users remain',
    (leftoverUsers ?? []).length === 0,
    `${(leftoverUsers ?? []).length} left with prefix ${world.tag}`,
  );

  const { data: leftoverStores } = await admin
    .from('stores').select('id').like('slug', `${world.tag}%`);
  report.check(
    'no test stores remain',
    (leftoverStores ?? []).length === 0,
    `${(leftoverStores ?? []).length} left`,
  );

  const { data: leftoverPayments } = await admin
    .from('payments').select('id').like('razorpay_payment_id', `pay_e2e_${world.runId}%`);
  report.check(
    'no simulated payment rows remain',
    (leftoverPayments ?? []).length === 0,
    `${(leftoverPayments ?? []).length} left`,
  );
}
