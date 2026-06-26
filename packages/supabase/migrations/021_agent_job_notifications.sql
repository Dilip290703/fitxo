-- Migration 021: reliable "new job" signal for the agent panel
-- Run in Supabase SQL Editor after migration 020.
--
-- WHY: the agent "new job" pop-up first tried to listen for the assign-UPDATE on
-- `deliveries` (rider_id NULL -> rider). But Supabase `postgres_changes` does NOT
-- reliably deliver an UPDATE that moves a row *into* a user's RLS visibility — so
-- the rider never got the event (the alert "only went to admin"). Fix: when a
-- delivery is assigned, a trigger inserts a `notifications` row owned by the rider.
-- That row is *born* visible to the rider (user_id = them), so a plain INSERT
-- subscription on `notifications` (filtered to their user_id) fires every time.
--
-- Idempotent.
-- ============================================================

-- Insert a rider-owned notification whenever a delivery gets a rider_id for the
-- first time (admin assignment, or an insert that already carries a rider).
CREATE OR REPLACE FUNCTION notify_rider_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order_number TEXT;
BEGIN
  IF NEW.rider_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only on the NULL -> rider transition (INSERT with rider, or UPDATE that sets it).
  IF TG_OP = 'UPDATE' AND OLD.rider_id IS NOT DISTINCT FROM NEW.rider_id THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id FROM riders WHERE id = NEW.rider_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_number INTO v_order_number FROM orders WHERE id = NEW.order_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'order_update',
    'New delivery assigned',
    'Order ' || COALESCE(v_order_number, '') || ' is ready to pick up. Tap to accept.',
    jsonb_build_object('kind', 'new_job', 'delivery_id', NEW.id, 'order_id', NEW.order_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rider_on_assignment ON deliveries;
CREATE TRIGGER trg_notify_rider_on_assignment
  AFTER INSERT OR UPDATE OF rider_id ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION notify_rider_on_assignment();

-- Put notifications on the realtime publication so the rider's INSERT subscription
-- fires. INSERTs are born-visible, so default REPLICA IDENTITY (PK) is enough.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
