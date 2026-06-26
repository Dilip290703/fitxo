-- Migration 023: reliable try-window + decision signals for the AGENT panel
-- Run in Supabase SQL Editor after migration 022.
--
-- WHY: same story as 021/022. The agent's "try-on started" and "item kept/returned"
-- pop-ups listened to `try_sessions` / `order_items` directly, whose RLS policies
-- (try_sessions_select_rider, order_items_select_rider) are joins through
-- `deliveries` → Realtime can't reliably route them. Route through born-visible
-- `notifications` owned by the assigned rider instead, so every event lands. The
-- agent panel now drives ALL its alerts off its own notifications stream.
--
-- Idempotent.
-- ============================================================

-- Helper: the user_id of the rider currently assigned to an order (NULL if none).
CREATE OR REPLACE FUNCTION rider_user_for_order(p_order_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id
  FROM deliveries d
  JOIN riders r ON r.id = d.rider_id
  WHERE d.order_id = p_order_id AND d.rider_id IS NOT NULL
  LIMIT 1;
$$;

-- try_sessions → "customer started their try-on"
CREATE OR REPLACE FUNCTION notify_rider_on_try_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_delivery UUID;
  v_order_number TEXT;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW; -- already active, don't re-fire
  END IF;

  v_user := rider_user_for_order(NEW.order_id);
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_delivery FROM deliveries WHERE order_id = NEW.order_id LIMIT 1;
  SELECT order_number INTO v_order_number FROM orders WHERE id = NEW.order_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user, 'order_update', 'Try-on started',
    'Order ' || COALESCE(v_order_number, '') || ' — the customer is trying items on.',
    jsonb_build_object('kind', 'try_started', 'delivery_id', v_delivery, 'order_id', NEW.order_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rider_on_try_active ON try_sessions;
CREATE TRIGGER trg_notify_rider_on_try_active
  AFTER INSERT OR UPDATE OF status ON try_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_rider_on_try_active();

-- order_items → "customer kept / returned an item"
CREATE OR REPLACE FUNCTION notify_rider_on_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_delivery UUID;
BEGIN
  IF NEW.decision NOT IN ('keep', 'return') THEN
    RETURN NEW;
  END IF;
  IF OLD.decision IS NOT DISTINCT FROM NEW.decision THEN
    RETURN NEW; -- decision didn't actually change
  END IF;

  v_user := rider_user_for_order(NEW.order_id);
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_delivery FROM deliveries WHERE order_id = NEW.order_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user, 'order_update',
    CASE WHEN NEW.decision = 'return' THEN 'Item to collect' ELSE 'Item kept' END,
    COALESCE(NEW.product_name, 'An item') ||
      CASE WHEN NEW.decision = 'return' THEN ' — collect it back.' ELSE ' — customer is keeping it.' END,
    jsonb_build_object(
      'kind', CASE WHEN NEW.decision = 'return' THEN 'item_returned' ELSE 'item_kept' END,
      'delivery_id', v_delivery, 'order_id', NEW.order_id,
      'order_item_id', NEW.id, 'product_name', NEW.product_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rider_on_decision ON order_items;
CREATE TRIGGER trg_notify_rider_on_decision
  AFTER UPDATE OF decision ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_rider_on_decision();
