-- Migration 008: store profile editing + staff roster (Store panel #11/#12)
-- Run in Supabase SQL Editor after migration 007.
--
-- Two gaps, both closed with guarded SECURITY DEFINER RPCs instead of broad
-- policies (same pattern as set_order_item_prepared in 007):
--
-- 1. Managers have no UPDATE on `stores`. A blanket UPDATE policy would let a
--    store flip its own is_active/is_verified (RLS can't restrict columns), so
--    update_store_profile() updates ONLY the safe contact/profile columns.
-- 2. store_managers_select only shows a manager their OWN row, and users RLS
--    hides co-managers' names/emails. get_store_staff() returns the roster for
--    a store the caller manages, without widening either table's policies.

-- ---- 1. Edit own store profile (safe columns only) -------------------------
CREATE OR REPLACE FUNCTION update_store_profile(
  p_store_id      UUID,
  p_description   TEXT,
  p_contact_email VARCHAR,
  p_contact_phone VARCHAR,
  p_address       TEXT,
  p_city          VARCHAR,
  p_pincode       VARCHAR
) RETURNS VOID AS $$
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to update this store';
  END IF;

  UPDATE stores SET
    description   = p_description,
    contact_email = p_contact_email,
    contact_phone = p_contact_phone,
    address       = p_address,
    city          = p_city,
    pincode       = p_pincode,
    updated_at    = NOW()
  WHERE id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_store_profile(UUID, TEXT, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR) TO authenticated;

-- ---- 2. Staff roster for a store the caller manages -------------------------
CREATE OR REPLACE FUNCTION get_store_staff(p_store_id UUID)
RETURNS TABLE (
  user_id     UUID,
  name        VARCHAR,
  email       VARCHAR,
  is_active   BOOLEAN,
  assigned_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to view this store''s staff';
  END IF;

  RETURN QUERY
  SELECT sm.user_id, u.name, u.email, sm.is_active, sm.assigned_at
  FROM store_managers sm
  JOIN users u ON u.id = sm.user_id
  WHERE sm.store_id = p_store_id
  ORDER BY sm.assigned_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_store_staff(UUID) TO authenticated;
