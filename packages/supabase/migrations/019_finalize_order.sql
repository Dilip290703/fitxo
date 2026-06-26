-- Migration 019: complete an order once every item has been decided
-- Run in Supabase SQL Editor after migration 018.
-- (Already applied earlier as "015_finalize_order" — renumbered to 019 to avoid
--  the clash with 015_auto_provision_users; re-running is idempotent.)
--
-- The keep flow (confirm_keep_payment) and the return flow (returnItem) each set
-- a single item's decision, but nothing closed the loop: the try_session stayed
-- 'active' and the order stayed 'try_window_active', so the customer's countdown
-- kept running after they'd already kept/returned everything.
--
-- finalize_order_if_decided() is called after each keep/return. When NO item is
-- still 'pending', it closes the try session and completes the order. Idempotent
-- and ownership-checked (SECURITY DEFINER bypasses RLS, so we verify the caller
-- owns the order or is an admin).

CREATE OR REPLACE FUNCTION finalize_order_if_decided(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND (o.user_id = auth.uid() OR is_admin())
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  -- Don't finalize while any item is still undecided.
  IF EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.decision = 'pending'
  ) THEN
    RETURN;
  END IF;

  -- Stop the try-window clock.
  UPDATE try_sessions
     SET status = 'completed'
   WHERE order_id = p_order_id AND status = 'active';

  -- Complete the order (only from an in-flight try/return state, never from
  -- cancelled/already-completed).
  UPDATE orders
     SET status = 'completed', updated_at = NOW()
   WHERE id = p_order_id
     AND status IN ('try_window_active', 'return_requested', 'return_picked');
END;
$$;

REVOKE ALL ON FUNCTION finalize_order_if_decided(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_order_if_decided(UUID) TO authenticated;
