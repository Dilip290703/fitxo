-- Migration 060: the store panel finds out when an order changes under it.
-- Run after 059 (055 is still reserved for M4 tax provisions). Idempotent.
--
-- THE GAP (audited 2026-08-12, verified again 2026-08-17):
--
-- A customer taps "Return" on an item and the signal reaches the customer
-- (own action) and the rider (023's notification + a 4s poll). It reaches the
-- STORE nowhere at all. Same for a cancellation: 054 and 058 both DO insert an
-- `order_cancelled` row for every active store manager — the row lands in the
-- database and the store UI throws it away, because OrderAlertsProvider
-- hard-filters `kind = 'new_store_order'`.
--
-- That is not cosmetic. Under the upfront-fee model (G9/050) a cancelled order
-- has already taken the customer's fee, and the store manager carries on
-- picking and packing something that no longer exists.
--
-- Two halves, and the store panel needs both:
--   1. THIS migration — a store-side equivalent of 023's
--      `notify_rider_on_decision`, so keep/return actually emits something a
--      store manager owns.
--   2. The store panel widening its kind filter + polling its screens
--      (same commit, `apps/store`).
--
-- Also fixes a rename leftover: 058's `cancel_order_by_admin` builds two
-- notification bodies containing the literal string "Fitzo support". Migration
-- 059 renamed `site_name`, `contact_email` and the order-number prefix, but a
-- repo-wide rename cannot see string literals baked into a function body, so
-- every admin cancellation has been telling the customer the old brand name.
-- ============================================================

-- 1. Keep/return reaches the store -------------------------------------------
--    Mirrors 023's notify_rider_on_decision, but fans out to the managers of
--    the store that owns the product rather than to the assigned rider. The
--    store's stock already moves on its own (047's release triggers) and its
--    earnings already change; this is only about the screen knowing.
--
--    Deliberately reuses 023's `item_kept` / `item_returned` kind vocabulary:
--    notifications are addressed per user_id, so the recipient disambiguates
--    them and the store client can share one switch with the agent client.
CREATE OR REPLACE FUNCTION notify_store_on_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id    UUID;
  v_order_num   TEXT;
  m             RECORD;
BEGIN
  IF NEW.decision NOT IN ('keep', 'return') THEN
    RETURN NEW;
  END IF;
  IF OLD.decision IS NOT DISTINCT FROM NEW.decision THEN
    RETURN NEW; -- decision didn't actually change
  END IF;

  SELECT store_id INTO v_store_id FROM products WHERE id = NEW.product_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_number INTO v_order_num FROM orders WHERE id = NEW.order_id;

  FOR m IN
    SELECT user_id FROM store_managers
     WHERE store_id = v_store_id AND is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      m.user_id, 'order_update',
      CASE WHEN NEW.decision = 'return' THEN 'Item coming back' ELSE 'Item kept' END,
      COALESCE(NEW.product_name, 'An item') || ' · order ' || COALESCE(v_order_num, '') ||
        CASE WHEN NEW.decision = 'return'
             THEN ' — the customer returned it.'
             ELSE ' — the customer kept it.' END,
      jsonb_build_object(
        'kind', CASE WHEN NEW.decision = 'return' THEN 'item_returned' ELSE 'item_kept' END,
        'order_id', NEW.order_id,
        'order_item_id', NEW.id,
        'product_name', NEW.product_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_store_on_decision ON order_items;
CREATE TRIGGER trg_notify_store_on_decision
  AFTER UPDATE OF decision ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_store_on_decision();

-- 2. Brand leftover in 058's admin cancel ------------------------------------
--    Byte-for-byte 058's function with the two customer/store-facing strings
--    corrected. Nothing else changes: same signature, same guards, same
--    best-effort refund contract (the app moves the money and then calls
--    record_cancel_fee_refund; a failed refund leaves the order cancelled and
--    the row visible in pending_fee_refunds()).
CREATE OR REPLACE FUNCTION cancel_order_by_admin(p_order_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status    order_status;
  v_order_num TEXT;
  v_user      UUID;
  v_fee_pid   TEXT;
  v_fee_amt   NUMERIC;
  m           RECORD;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;

  SELECT status, order_number, user_id
    INTO v_status, v_order_num, v_user
    FROM orders WHERE id = p_order_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object('cancelled', true, 'already', true, 'fee_refund_payment_id', NULL);
  END IF;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'CANCEL_ALREADY_COMPLETED';
  END IF;

  -- Cancel — the 047 trigger releases any still-reserved stock.
  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;

  UPDATE deliveries SET status = 'failed', completed_at = now()
   WHERE order_id = p_order_id AND status NOT IN ('completed', 'failed');
  UPDATE try_sessions SET status = 'expired'
   WHERE order_id = p_order_id AND status = 'active';

  -- The customer was told nothing by the old client-side cancel. Tell them.
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user, 'order_update', 'Order cancelled',
    'Order ' || COALESCE(v_order_num, '') || ' was cancelled by Fitxo support. ' ||
      btrim(p_reason),
    jsonb_build_object('kind', 'order_cancelled_by_admin', 'order_id', p_order_id)
  );

  -- Stores with items in the order stop preparing it (022's born-visible rows).
  FOR m IN
    SELECT DISTINCT sm.user_id
      FROM order_items oi
      JOIN products p        ON p.id = oi.product_id
      JOIN store_managers sm ON sm.store_id = p.store_id
     WHERE oi.order_id = p_order_id AND sm.is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      m.user_id, 'order_update', 'Order cancelled',
      'Order ' || COALESCE(v_order_num, '') || ' was cancelled by Fitxo support.',
      jsonb_build_object('kind', 'order_cancelled', 'order_id', p_order_id)
    );
  END LOOP;

  -- Hand back the standalone upfront fee payment, if any — the APP moves the
  -- money (it holds the Razorpay keys) and then calls record_cancel_fee_refund,
  -- exactly as 054 does. If that refund fails, the order is still cancelled and
  -- this row surfaces in pending_fee_refunds() until someone retries.
  SELECT razorpay_payment_id, delivery_fee_component
    INTO v_fee_pid, v_fee_amt
    FROM payments
   WHERE order_id = p_order_id
     AND order_item_id IS NULL
     AND status = 'success'
     AND COALESCE(delivery_fee_component, 0) > 0
     AND razorpay_payment_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'cancelled', true,
    'order_number', v_order_num,
    'fee_refund_payment_id', v_fee_pid,
    'fee_amount', v_fee_amt
  );
END;
$$;
