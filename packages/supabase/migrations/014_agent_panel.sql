-- Migration 014: Delivery Agent panel — rider auth gate, delivery lifecycle,
-- the doorstep "rider delivered → customer starts 7-min try window" flow, and Realtime.
-- Run in the Supabase SQL Editor.
--
-- Model: a rider is a `users` row with role='rider' + a `riders` row. They can only
-- WORK once an admin sets riders.is_verified=true. Rider writes go through guarded
-- SECURITY DEFINER RPCs (same pattern as the Store panel) because RLS otherwise forbids
-- a rider from touching orders/deliveries they don't own as a customer.

-- ============================================================
-- Helpers
-- ============================================================
CREATE OR REPLACE FUNCTION is_rider() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'rider');
$$;

CREATE OR REPLACE FUNCTION current_rider_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM riders WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- Auto-create a delivery row when an order is placed (so admin/rider has
-- something to assign). Denormalises the drop address onto the delivery so a
-- rider can see where to go without us widening RLS on users/addresses.
-- ============================================================
CREATE OR REPLACE FUNCTION create_delivery_for_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_addr addresses%ROWTYPE;
BEGIN
  SELECT * INTO v_addr FROM addresses WHERE id = NEW.address_id;
  INSERT INTO deliveries (order_id, type, status, drop_address)
  VALUES (
    NEW.id, 'delivery', 'assigned',
    CASE WHEN v_addr.id IS NOT NULL THEN jsonb_build_object(
      'full_name', v_addr.full_name, 'phone', v_addr.phone, 'line1', v_addr.line1,
      'line2', v_addr.line2, 'landmark', v_addr.landmark, 'city', v_addr.city,
      'state', v_addr.state, 'pincode', v_addr.pincode
    ) ELSE '{}'::jsonb END
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_create_delivery ON orders;
CREATE TRIGGER trg_create_delivery AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION create_delivery_for_order();

-- ============================================================
-- RLS: a verified rider can read the orders/items/sessions tied to a delivery
-- assigned to them, and toggle their own availability.
-- ============================================================
DROP POLICY IF EXISTS riders_update_own ON riders;
CREATE POLICY riders_update_own ON riders FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS orders_select_rider ON orders;
CREATE POLICY orders_select_rider ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM deliveries d JOIN riders r ON r.id = d.rider_id
          WHERE d.order_id = orders.id AND r.user_id = auth.uid())
);

DROP POLICY IF EXISTS order_items_select_rider ON order_items;
CREATE POLICY order_items_select_rider ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM deliveries d JOIN riders r ON r.id = d.rider_id
          WHERE d.order_id = order_items.order_id AND r.user_id = auth.uid())
);

DROP POLICY IF EXISTS try_sessions_select_rider ON try_sessions;
CREATE POLICY try_sessions_select_rider ON try_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM deliveries d JOIN riders r ON r.id = d.rider_id
          WHERE d.order_id = try_sessions.order_id AND r.user_id = auth.uid())
);

-- (deliveries already has deliveries_select for the assigned rider, from schema.sql)

-- ============================================================
-- Rider action RPCs (guarded). Each checks the caller is the verified rider
-- on that delivery, then advances both the delivery and the order.
-- ============================================================
CREATE OR REPLACE FUNCTION rider_set_availability(p_available boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE riders SET is_available = p_available WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not a rider'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION rider_accept_delivery(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a verified rider'; END IF;
  -- Admin assigns deliveries (sets rider_id); the rider acknowledges by accepting.
  UPDATE deliveries SET status = 'accepted', accepted_at = now()
   WHERE id = p_delivery_id AND rider_id = v_rider AND status = 'assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not available to accept'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION rider_mark_picked_up(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'picked_up', picked_up_at = now()
   WHERE id = p_delivery_id AND rider_id = v_rider AND status IN ('accepted')
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot mark picked up'; END IF;
  UPDATE orders SET status = 'out_for_delivery' WHERE id = v_order;
END; $$;

-- Rider arrives + hands the order to the customer at the door. This is the
-- "Mark delivered" action — it flips the order to 'delivered', which the
-- customer's tracking page picks up over Realtime to show the start-window prompt.
CREATE OR REPLACE FUNCTION rider_mark_delivered(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'arrived'
   WHERE id = p_delivery_id AND rider_id = v_rider AND status IN ('picked_up','en_route','accepted')
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot mark delivered'; END IF;
  UPDATE orders SET status = 'delivered' WHERE id = v_order;
END; $$;

-- After the try window, the rider collects any returns and closes out.
CREATE OR REPLACE FUNCTION rider_complete_delivery(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id AND rider_id = v_rider
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot complete delivery'; END IF;
  UPDATE orders SET status = 'completed' WHERE id = v_order;
  UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;

-- ============================================================
-- Customer RPC: accept the prompt → start the 7-minute try window.
-- (Customer can't UPDATE try_sessions under RLS, so this guarded fn does it.)
-- ============================================================
CREATE OR REPLACE FUNCTION start_try_window(p_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_minutes int := 7; v_deadline timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  v_deadline := now() + (v_minutes || ' minutes')::interval;
  UPDATE orders SET status = 'try_window_active', try_deadline = v_deadline
   WHERE id = p_order_id AND status = 'delivered';
  IF NOT FOUND THEN RAISE EXCEPTION 'order is not awaiting a try window'; END IF;
  UPDATE try_sessions SET started_at = now(), deadline_at = v_deadline, status = 'active'
   WHERE order_id = p_order_id;
END; $$;

-- ============================================================
-- Grants
-- ============================================================
REVOKE ALL ON FUNCTION rider_set_availability(boolean)   FROM PUBLIC;
REVOKE ALL ON FUNCTION rider_accept_delivery(uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION rider_mark_picked_up(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION rider_mark_delivered(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION rider_complete_delivery(uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION start_try_window(uuid)            FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_set_availability(boolean)   TO authenticated;
GRANT EXECUTE ON FUNCTION rider_accept_delivery(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION rider_mark_picked_up(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION rider_mark_delivered(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION rider_complete_delivery(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION start_try_window(uuid)            TO authenticated;

-- ============================================================
-- Realtime — let the customer + agent panels get live status/timer updates.
-- (RLS still applies to what each subscriber receives.)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='try_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE try_sessions; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='deliveries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE deliveries; END IF;
END $$;
