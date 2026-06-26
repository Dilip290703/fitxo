-- Migration 013: gate the delivery (and the rider hand-off) on the STORE
-- confirming the order, instead of auto-creating a delivery at checkout.
-- Run once in the Supabase SQL Editor after migration 012.
--
-- WHY: migration 011 created the delivery row in an AFTER INSERT trigger on
-- orders, so a delivery existed the instant a customer checked out — before any
-- store had confirmed it actually has the items. That skipped the store step:
--   place order (pending) -> STORE confirms stock (confirmed) -> rider hand-off.
-- This migration removes the auto-create trigger and moves delivery creation
-- into a guarded store_confirm_order() RPC. The customer's order-tracking page
-- already has a "Confirmed" step, and the agent panel already only sees a
-- delivery once one exists, so both ends pick this up with no further change.

-- 1. Stop auto-creating the delivery at checkout. (Keep the function defined;
--    store_confirm_order below reuses the same drop-address denormalisation.)
DROP TRIGGER IF EXISTS trg_create_delivery ON orders;

-- 2. Store confirms an order it can fulfil: pending -> confirmed, and create the
--    delivery so admin can assign a rider. SECURITY DEFINER bypasses RLS, but the
--    is_store_manager_of() check (auth.uid() is still the caller) ensures only a
--    store that actually has a line item in this order can confirm it.
CREATE OR REPLACE FUNCTION store_confirm_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addr   addresses%ROWTYPE;
  v_status order_status;
  v_addr_id UUID;
BEGIN
  -- Caller must manage the store of at least one item in this order.
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to confirm this order';
  END IF;

  -- Lock the order and only act while it is still pending (idempotent / no
  -- double hand-off if two stores on a multi-store order both confirm).
  SELECT status, address_id INTO v_status, v_addr_id
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_status <> 'pending' THEN
    RETURN; -- already confirmed (or further along) — nothing to do
  END IF;

  UPDATE orders SET status = 'confirmed' WHERE id = p_order_id;

  -- Create the delivery (rider_id stays NULL until admin assigns one), unless a
  -- delivery row somehow already exists for this order.
  IF NOT EXISTS (SELECT 1 FROM deliveries WHERE order_id = p_order_id AND type = 'delivery') THEN
    SELECT * INTO v_addr FROM addresses WHERE id = v_addr_id;
    INSERT INTO deliveries (order_id, type, status, drop_address)
    VALUES (
      p_order_id, 'delivery', 'assigned',
      CASE WHEN v_addr.id IS NOT NULL THEN jsonb_build_object(
        'full_name', v_addr.full_name, 'phone', v_addr.phone, 'line1', v_addr.line1,
        'line2', v_addr.line2, 'landmark', v_addr.landmark, 'city', v_addr.city,
        'state', v_addr.state, 'pincode', v_addr.pincode
      ) ELSE '{}'::jsonb END
    );
  END IF;
END; $$;

-- 3. Allow logged-in users to call it (the function enforces store ownership).
GRANT EXECUTE ON FUNCTION store_confirm_order(UUID) TO authenticated;
