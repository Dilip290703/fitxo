-- ============================================================
-- 051 — Coupons lockdown: no anon reads + validate_coupon() RPC
--        (security half of W3.2 lean coupons; found by the W4.1 RLS probe)
--
-- WHY: schema.sql's day-one policy was
--   coupons_select: USING (is_active = true OR is_admin())
-- so anyone holding the (public) anon key could enumerate EVERY active promo
-- code via GET /rest/v1/coupons — including limited-use ones (SUMMER2026 has
-- usage_limit = 1). A promo code is a secret the customer brings to us, not
-- a list we hand out.
--
-- SHAPE:
--   1) The coupons table becomes admin-only (reads AND writes). The admin
--      panel keeps working untouched — it reads with the owner's session and
--      is_admin() passes; nothing else in any app selects from coupons.
--   2) validate_coupon(p_code, p_subtotal) is the ONLY customer-facing door:
--      SECURITY DEFINER, authenticated-only, checks ONE exact submitted code
--      and returns its discount — a caller can test codes they know, never
--      list codes they don't.
--
-- validate_coupon deliberately does NOT increment used_count: validation is
-- not redemption (else previewing a code at checkout burns a usage_limit=1
-- coupon). The increment + stamping into orders.coupon_code/coupon_discount
-- belongs to the redemption half of W3.2 (place_order, with the agreed
-- commission-base rule) — not built here.
--
-- Idempotent: policy drops are IF EXISTS, function is CREATE OR REPLACE.
-- Apply after 050. (M4 tax provisions move to 052.)
-- After applying, scripts/supabase/rls-probe.mjs treats coupons as a
-- sensitive table — anon must see zero rows.
-- ============================================================

-- 1) Replace the world-readable SELECT policy with admin-only.
--    (coupons_admin_all FOR ALL already grants admins SELECT; the explicit
--    admin-only SELECT policy keeps intent readable in pg_policies.)
DROP POLICY IF EXISTS coupons_select ON coupons;
DROP POLICY IF EXISTS coupons_select_admin ON coupons;
CREATE POLICY coupons_select_admin ON coupons FOR SELECT USING (is_admin());

-- 2) The one customer-facing door: check a single submitted code.
--    Returns exactly one row:
--      valid = true  → discount is the rupee value for p_subtotal
--                      (percent capped by max_discount_amount, never > subtotal)
--      valid = false → reason ∈ INVALID_CODE   (unknown OR inactive — one
--                                               answer, so inactive codes
--                                               can't be confirmed to exist)
--                               NOT_STARTED    (valid_from in the future)
--                               EXPIRED        (valid_until passed)
--                               USAGE_LIMIT    (fully redeemed)
--                               MIN_ORDER      (min_amount says how far off)
CREATE OR REPLACE FUNCTION validate_coupon(p_code text, p_subtotal numeric)
RETURNS TABLE (
  valid       boolean,
  reason      text,
  code        varchar(50),
  description text,
  discount    numeric,
  min_amount  numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c        coupons%ROWTYPE;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_subtotal IS NULL OR p_subtotal < 0 THEN
    RAISE EXCEPTION 'invalid subtotal';
  END IF;

  SELECT * INTO c
    FROM coupons
   WHERE upper(coupons.code) = upper(trim(p_code));

  -- Unknown and inactive answer identically: a disabled code must not be
  -- distinguishable from one that never existed.
  IF NOT FOUND OR NOT c.is_active THEN
    RETURN QUERY SELECT false, 'INVALID_CODE', NULL::varchar(50), NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF c.valid_from > now() THEN
    RETURN QUERY SELECT false, 'NOT_STARTED', c.code, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN QUERY SELECT false, 'EXPIRED', c.code, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN
    RETURN QUERY SELECT false, 'USAGE_LIMIT', c.code, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF p_subtotal < c.min_order_amount THEN
    RETURN QUERY SELECT false, 'MIN_ORDER', c.code, NULL::text, NULL::numeric, c.min_order_amount;
    RETURN;
  END IF;

  IF c.discount_type = 'percent' THEN
    v_amount := round(p_subtotal * c.discount_value / 100.0, 2);
    IF c.max_discount_amount IS NOT NULL AND v_amount > c.max_discount_amount THEN
      v_amount := c.max_discount_amount;
    END IF;
  ELSE
    v_amount := c.discount_value;
  END IF;
  IF v_amount > p_subtotal THEN
    v_amount := p_subtotal;
  END IF;

  RETURN QUERY SELECT true, NULL::text, c.code, c.description, v_amount, c.min_order_amount;
END;
$$;

-- Authenticated-only: anon holds no door into coupons at all.
REVOKE EXECUTE ON FUNCTION validate_coupon(text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_coupon(text, numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION validate_coupon(text, numeric) TO authenticated;
