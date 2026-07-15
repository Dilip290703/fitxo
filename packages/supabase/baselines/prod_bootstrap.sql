-- ============================================================
-- FITZO prod bootstrap — generated 2026-07-15 from the repo
-- Reproduces the full schema on a FRESH Supabase project:
--   schema.sql (v0 base) + migrations 001-047, in order + config seed.
-- Wrapped in one transaction: any error rolls the ENTIRE apply back,
-- so you can fix and re-run cleanly (schema.sql is not idempotent alone).
-- EXCLUDED (manual, see docs/ENVIRONMENTS.md Part C/D):
--   * Vault secrets (razorpay_key_secret / _webhook_secret) — prod values
--   * first admin user (sign up, then UPDATE users SET role='admin')
--   * pg_cron schedules (commented in 027/036 — enable in W2.9)
--   * postgis (unused by the app — commented below)
-- ============================================================

BEGIN;

-- ==================== schema.sql (v0 base) ====================
-- ============================================================
-- FITZO — Complete PostgreSQL Schema
-- Fashion Try-and-Buy Platform
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- (postgis omitted: unused by the app)

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'store_manager', 'rider');
CREATE TYPE gender_type AS ENUM ('men', 'women', 'kids', 'unisex');
CREATE TYPE fit_type AS ENUM ('slim', 'regular', 'oversized', 'relaxed');
CREATE TYPE size_type AS ENUM ('alpha', 'numeric', 'uk', 'eu', 'us');
CREATE TYPE image_angle AS ENUM ('front', 'back', 'side', 'detail', 'lifestyle', 'flat_lay');
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'assigned', 'out_for_delivery',
  'delivered', 'try_window_active', 'return_requested',
  'return_picked', 'completed', 'cancelled'
);
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'partially_paid', 'refunded');
CREATE TYPE payment_method AS ENUM ('razorpay', 'cod', 'wallet');
CREATE TYPE item_decision AS ENUM ('pending', 'keep', 'return');
CREATE TYPE delivery_type AS ENUM ('delivery', 'return_pickup');
CREATE TYPE delivery_status AS ENUM (
  'assigned', 'accepted', 'picked_up', 'en_route', 'arrived', 'completed', 'failed'
);
CREATE TYPE vehicle_type AS ENUM ('bike', 'cycle', 'scooter');
CREATE TYPE discount_type AS ENUM ('percent', 'flat');
CREATE TYPE notification_type AS ENUM ('order_update', 'promo', 'system');

-- ============================================================
-- 1. STORES
-- ============================================================

CREATE TABLE stores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  logo_url      TEXT,
  description   TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  address       TEXT,
  city          VARCHAR(100),
  pincode       VARCHAR(10),
  lat           DECIMAL(10, 8),
  lng           DECIMAL(11, 8),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. BRANDS
-- ============================================================

CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE NOT NULL,
  logo_url    TEXT,
  description TEXT,
  website_url TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. CATEGORIES (self-referencing hierarchy)
-- ============================================================

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(255) UNIQUE NOT NULL,
  parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  gender     gender_type NOT NULL DEFAULT 'unisex',
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. USERS (linked to Supabase auth.users)
-- ============================================================

CREATE TABLE users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             VARCHAR(255),
  email            VARCHAR(255) UNIQUE NOT NULL,
  phone            VARCHAR(20),
  role             user_role NOT NULL DEFAULT 'customer',
  avatar_url       TEXT,
  date_of_birth    DATE,
  gender           gender_type,
  skin_tone        VARCHAR(50),
  skin_undertone   VARCHAR(50),
  preferred_sizes  JSONB DEFAULT '{}',
  preferred_brands UUID[],
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_blocked       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ
);

-- ============================================================
-- 5. PRODUCTS
-- ============================================================

CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  brand_id          UUID REFERENCES brands(id) ON DELETE SET NULL,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) UNIQUE NOT NULL,
  description       TEXT,
  short_description VARCHAR(500),
  material          VARCHAR(255),
  care_instructions TEXT,
  fit_type          fit_type,
  base_price        DECIMAL(10, 2) NOT NULL,
  discounted_price  DECIMAL(10, 2),
  deposit_amount    DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_deleted        BOOLEAN NOT NULL DEFAULT false,
  is_featured       BOOLEAN NOT NULL DEFAULT false,
  tags              TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 6. PRODUCT COLORS
-- ============================================================

CREATE TABLE product_colors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name   VARCHAR(100) NOT NULL,
  color_hex    VARCHAR(7),
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0
);

-- ============================================================
-- 7. PRODUCT VARIANTS (color + size combo)
-- ============================================================

CREATE TABLE product_variants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id     UUID NOT NULL REFERENCES product_colors(id) ON DELETE CASCADE,
  size         VARCHAR(20) NOT NULL,
  size_type    size_type NOT NULL DEFAULT 'alpha',
  stock_qty    INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  reserved_qty INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  sku          VARCHAR(100) UNIQUE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT reserved_lte_stock CHECK (reserved_qty <= stock_qty)
);

-- Computed column available_qty via generated column
ALTER TABLE product_variants
  ADD COLUMN available_qty INT GENERATED ALWAYS AS (stock_qty - reserved_qty) STORED;

-- ============================================================
-- 8. PRODUCT IMAGES
-- ============================================================

CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id   UUID REFERENCES product_colors(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  angle      image_angle NOT NULL DEFAULT 'front',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  alt_text   VARCHAR(255)
);

-- ============================================================
-- 9. ADDRESSES
-- ============================================================

CREATE TABLE addresses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      VARCHAR(20) NOT NULL DEFAULT 'home',
  full_name  VARCHAR(255) NOT NULL,
  phone      VARCHAR(20) NOT NULL,
  line1      VARCHAR(255) NOT NULL,
  line2      VARCHAR(255),
  landmark   VARCHAR(255),
  city       VARCHAR(100) NOT NULL,
  state      VARCHAR(100) NOT NULL,
  pincode    VARCHAR(10) NOT NULL,
  lat        DECIMAL(10, 8),
  lng        DECIMAL(11, 8),
  is_default BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- 10. ORDERS
-- ============================================================

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number        VARCHAR(20) UNIQUE NOT NULL,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  address_id          UUID REFERENCES addresses(id) ON DELETE SET NULL,
  status              order_status NOT NULL DEFAULT 'pending',
  subtotal            DECIMAL(10, 2) NOT NULL DEFAULT 0,
  deposit_total       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_fee        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount     DECIMAL(10, 2) NOT NULL DEFAULT 0,
  final_amount        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  coupon_code         VARCHAR(50),
  coupon_discount     DECIMAL(10, 2) NOT NULL DEFAULT 0,
  try_deadline        TIMESTAMPTZ,
  payment_status      payment_status NOT NULL DEFAULT 'pending',
  payment_method      payment_method,
  razorpay_order_id   VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate human-readable order numbers
CREATE SEQUENCE order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'FTZ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- 11. ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id      UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name    VARCHAR(255) NOT NULL,
  color_name      VARCHAR(100) NOT NULL,
  size            VARCHAR(20) NOT NULL,
  image_url       TEXT,
  price_at_order  DECIMAL(10, 2) NOT NULL,
  deposit_at_order DECIMAL(10, 2) NOT NULL DEFAULT 0,
  decision        item_decision NOT NULL DEFAULT 'pending',
  decision_at     TIMESTAMPTZ,
  return_reason   TEXT
);

-- ============================================================
-- 12. RIDERS (extended profile)
-- ============================================================

CREATE TABLE riders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type      vehicle_type NOT NULL DEFAULT 'bike',
  vehicle_number    VARCHAR(20),
  is_available      BOOLEAN NOT NULL DEFAULT false,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  current_lat       DECIMAL(10, 8),
  current_lng       DECIMAL(11, 8),
  total_deliveries  INT NOT NULL DEFAULT 0,
  rating            DECIMAL(3, 2) DEFAULT 5.00
);

-- ============================================================
-- 13. DELIVERIES
-- ============================================================

CREATE TABLE deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_id         UUID REFERENCES riders(id) ON DELETE SET NULL,
  type             delivery_type NOT NULL DEFAULT 'delivery',
  status           delivery_status NOT NULL DEFAULT 'assigned',
  pickup_address   JSONB NOT NULL DEFAULT '{}',
  drop_address     JSONB NOT NULL DEFAULT '{}',
  assigned_at      TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  distance_km      DECIMAL(6, 2),
  estimated_minutes INT,
  rider_notes      TEXT
);

-- ============================================================
-- 14. STORE MANAGERS
-- ============================================================

CREATE TABLE store_managers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

-- ============================================================
-- 15. COUPONS
-- ============================================================

CREATE TABLE coupons (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               VARCHAR(50) UNIQUE NOT NULL,
  description        TEXT,
  discount_type      discount_type NOT NULL DEFAULT 'percent',
  discount_value     DECIMAL(10, 2) NOT NULL,
  min_order_amount   DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_discount_amount DECIMAL(10, 2),
  usage_limit        INT,
  used_count         INT NOT NULL DEFAULT 0,
  valid_from         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until        TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 16. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL DEFAULT 'system',
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB DEFAULT '{}',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. ACTIVITY LOGS (admin audit trail)
-- ============================================================

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Products
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE NOT is_deleted;
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- Variants
CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_color_id ON product_variants(color_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);

-- Colors
CREATE INDEX idx_colors_product_id ON product_colors(product_id);

-- Images
CREATE INDEX idx_images_product_id ON product_images(product_id);
CREATE INDEX idx_images_color_id ON product_images(color_id);

-- Orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

-- Deliveries
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_rider_id ON deliveries(rider_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE NOT is_read;

-- Activity logs
CREATE INDEX idx_activity_logs_admin_id ON activity_logs(admin_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Categories
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Addresses
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_stores
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_store_manager_of(store_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_managers
    WHERE user_id = auth.uid() AND store_id = store_uuid AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- STORES: public read for active stores; admin full access
CREATE POLICY stores_select ON stores FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY stores_admin_all ON stores FOR ALL USING (is_admin());

-- BRANDS: public read; admin write
CREATE POLICY brands_select ON brands FOR SELECT USING (true);
CREATE POLICY brands_admin_all ON brands FOR ALL USING (is_admin());

-- CATEGORIES: public read; admin write
CREATE POLICY categories_select ON categories FOR SELECT USING (true);
CREATE POLICY categories_admin_all ON categories FOR ALL USING (is_admin());

-- USERS: users can see/edit own row; admins see all
CREATE POLICY users_select_own ON users FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY users_update_own ON users FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY users_admin_all ON users FOR ALL USING (is_admin());

-- PRODUCTS: public read active; admin + store_manager write
CREATE POLICY products_select ON products FOR SELECT USING ((is_active AND NOT is_deleted) OR is_admin());
CREATE POLICY products_admin_write ON products FOR ALL USING (is_admin());
CREATE POLICY products_manager_write ON products FOR UPDATE
  USING (is_store_manager_of(store_id));

-- PRODUCT COLORS: follow product visibility
CREATE POLICY colors_select ON product_colors FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND (NOT p.is_deleted OR is_admin())));
CREATE POLICY colors_admin_all ON product_colors FOR ALL USING (is_admin());

-- PRODUCT VARIANTS: follow product visibility
CREATE POLICY variants_select ON product_variants FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND (NOT p.is_deleted OR is_admin())));
CREATE POLICY variants_admin_all ON product_variants FOR ALL USING (is_admin());

-- PRODUCT IMAGES: public read
CREATE POLICY images_select ON product_images FOR SELECT USING (true);
CREATE POLICY images_admin_all ON product_images FOR ALL USING (is_admin());

-- ADDRESSES: users see own; admins see all
CREATE POLICY addresses_select ON addresses FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY addresses_insert ON addresses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY addresses_update ON addresses FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY addresses_delete ON addresses FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- ORDERS: users see own; admins see all
CREATE POLICY orders_select ON orders FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY orders_update ON orders FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY orders_admin_all ON orders FOR ALL USING (is_admin());

-- ORDER ITEMS: via order ownership
CREATE POLICY order_items_select ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR is_admin())));
CREATE POLICY order_items_admin_all ON order_items FOR ALL USING (is_admin());

-- RIDERS: riders see own; admins see all
CREATE POLICY riders_select ON riders FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY riders_admin_all ON riders FOR ALL USING (is_admin());

-- DELIVERIES: riders see assigned; admins see all
CREATE POLICY deliveries_select ON deliveries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY deliveries_admin_all ON deliveries FOR ALL USING (is_admin());

-- STORE MANAGERS: managers see own; admins see all
CREATE POLICY store_managers_select ON store_managers FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY store_managers_admin_all ON store_managers FOR ALL USING (is_admin());

-- COUPONS: public read active; admin write
CREATE POLICY coupons_select ON coupons FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY coupons_admin_all ON coupons FOR ALL USING (is_admin());

-- NOTIFICATIONS: users see own
CREATE POLICY notifications_select ON notifications FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY notifications_admin_all ON notifications FOR ALL USING (is_admin());

-- ACTIVITY LOGS: admin only
CREATE POLICY activity_logs_admin ON activity_logs FOR ALL USING (is_admin());

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('product-images', 'product-images', true),
--   ('brand-logos', 'brand-logos', true),
--   ('store-logos', 'store-logos', true),
--   ('avatars', 'avatars', false);


-- ==================== 002_try_loop.sql ====================
-- Migration 002: add the 4 tables required for the order→try→keep/return→payment loop
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Prerequisite: base schema (schema.sql / migration 001) must already be applied.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE try_session_status AS ENUM ('active', 'expired', 'completed');
CREATE TYPE return_condition    AS ENUM ('good', 'damaged');
CREATE TYPE return_status       AS ENUM ('requested', 'scheduled', 'picked_up', 'completed');
-- Distinct from the existing `payment_status` enum on the orders row.
-- This tracks individual payment-transaction outcomes.
CREATE TYPE payment_txn_status  AS ENUM ('pending', 'initiated', 'success', 'failed', 'refunded');
CREATE TYPE payout_status       AS ENUM ('pending', 'processing', 'paid');

-- ============================================================
-- TABLE: try_sessions
-- One per order. Created when the order is placed; deadline clock
-- runs from delivery (agent panel will update started_at on delivery).
-- ============================================================

CREATE TABLE try_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  status      try_session_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: returns
-- One row per order item the customer wants to return.
-- ============================================================

CREATE TABLE returns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id)      ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  reason        TEXT,
  condition     return_condition NOT NULL DEFAULT 'good',
  status        return_status    NOT NULL DEFAULT 'requested',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ============================================================
-- TABLE: payments
-- One row per payment transaction attempt (Razorpay or COD).
-- ============================================================

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  amount              DECIMAL(10, 2) NOT NULL,
  currency            VARCHAR(3)     NOT NULL DEFAULT 'INR',
  status              payment_txn_status NOT NULL DEFAULT 'pending',
  payment_method      payment_method NOT NULL,
  razorpay_order_id   VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_signature  VARCHAR(512),
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: payouts
-- One row per store payout for a completed order.
-- ============================================================

CREATE TABLE payouts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount     DECIMAL(10, 2) NOT NULL,
  status     payout_status NOT NULL DEFAULT 'pending',
  paid_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_try_sessions_order_id    ON try_sessions(order_id);
CREATE INDEX idx_try_sessions_status      ON try_sessions(status);
CREATE INDEX idx_try_sessions_deadline_at ON try_sessions(deadline_at);

CREATE INDEX idx_returns_order_id      ON returns(order_id);
CREATE INDEX idx_returns_order_item_id ON returns(order_item_id);
CREATE INDEX idx_returns_status        ON returns(status);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id  ON payments(user_id);
CREATE INDEX idx_payments_status   ON payments(status);

CREATE INDEX idx_payouts_store_id ON payouts(store_id);
CREATE INDEX idx_payouts_order_id ON payouts(order_id);
CREATE INDEX idx_payouts_status   ON payouts(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE try_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts      ENABLE ROW LEVEL SECURITY;

-- try_sessions: customer sees own; only admin may update status
CREATE POLICY try_sessions_select ON try_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR is_admin())
  ));
CREATE POLICY try_sessions_insert ON try_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY try_sessions_admin_all ON try_sessions FOR ALL USING (is_admin());

-- returns: customer creates and sees own; admin manages
CREATE POLICY returns_select ON returns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR is_admin())
  ));
CREATE POLICY returns_insert ON returns FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY returns_update ON returns FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY returns_admin_all ON returns FOR ALL USING (is_admin());

-- payments: customer creates and sees own; admin sees all
CREATE POLICY payments_select ON payments FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY payments_admin_all ON payments FOR ALL USING (is_admin());

-- payouts: store managers see their store's payouts; admin manages all
CREATE POLICY payouts_select ON payouts FOR SELECT
  USING (is_admin() OR is_store_manager_of(store_id));
CREATE POLICY payouts_admin_all ON payouts FOR ALL USING (is_admin());

-- ============================================================
-- BACKFILL: add missing INSERT policy on order_items for customers
-- (base schema only had SELECT + admin-all; customers couldn't insert)
-- ============================================================

CREATE POLICY order_items_insert ON order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));


-- ==================== 003_order_items_update_policy.sql ====================
-- Migration 003: add customer UPDATE policy on order_items
-- Required so customers can set keep/return decisions during the try window.
-- Run in Supabase SQL Editor after migration 002.

CREATE POLICY order_items_update ON order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));


-- ==================== 004_store_manager_read.sql ====================
-- Migration 004: store-manager READ access to their own catalogue, orders & returns
-- Run in Supabase SQL Editor after migration 003.
--
-- Why: store managers authenticate against the same Supabase project but, until
-- now, RLS only let them UPDATE their products and SELECT their payouts. They
-- could not read their own draft/inactive products, nor any orders/returns
-- containing their products (order_items has no store_id — visibility comes from
-- joining order_items → products → store_id). This unblocks the Store panel's
-- Dashboard, Catalogue, Order Management, Returns and Earnings screens.
--
-- All policies below are PERMISSIVE SELECT policies, so they are OR-ed with the
-- existing public/customer/admin policies — they only ADD visibility, never
-- remove it.

-- ============================================================
-- Helper: does the given order contain an item from a store the
-- current user manages? SECURITY DEFINER so the inner joins bypass
-- RLS on order_items/products and we avoid orders↔order_items recursion.
-- ============================================================
CREATE OR REPLACE FUNCTION is_my_store_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN store_managers sm ON sm.store_id = p.store_id
    WHERE oi.order_id = order_uuid
      AND sm.user_id = auth.uid()
      AND sm.is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- PRODUCTS: a manager can read ALL of their store's products
-- (incl. inactive/deleted drafts), on top of the public active view.
-- ============================================================
CREATE POLICY products_manager_select ON products FOR SELECT
  USING (is_store_manager_of(store_id));

-- PRODUCT VARIANTS: read variants of products the manager owns.
CREATE POLICY variants_manager_select ON product_variants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- ============================================================
-- ORDERS: a manager can read orders that contain at least one of
-- their products.
-- ============================================================
CREATE POLICY orders_manager_select ON orders FOR SELECT
  USING (is_my_store_order(id));

-- ORDER ITEMS: a manager can read only the line items that are their
-- products (so a multi-store order never exposes another store's lines).
CREATE POLICY order_items_manager_select ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- ============================================================
-- RETURNS: a manager can read returns for orders containing their products.
-- ============================================================
CREATE POLICY returns_manager_select ON returns FOR SELECT
  USING (is_my_store_order(order_id));


-- ==================== 005_reenable_rls.sql ====================
-- Migration 005: re-enable Row Level Security (SECURITY FIX)
-- Run in Supabase SQL Editor ASAP.
--
-- Discovered 2026-06-08 while building the Store Dashboard: with only the public
-- anon key and NO session, `users`, `orders`, and `order_items` were fully
-- readable (all customer names/emails/phones + all orders). The policies from
-- schema.sql are intact, so RLS had been DISABLED on these tables (typically
-- happens when it's toggled off to debug during dev and never turned back on).
--
-- `ENABLE ROW LEVEL SECURITY` is idempotent — running it on a table that already
-- has RLS enabled is a harmless no-op — so this re-asserts it across every table
-- that is supposed to have it, not just the three confirmed leaks. All these
-- tables already have policies (schema.sql + migrations 002/004), so enabling
-- RLS will not lock anyone out who should have access.

ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;  -- confirmed leak
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;  -- confirmed leak
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;  -- confirmed leak
ALTER TABLE riders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_managers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts          ENABLE ROW LEVEL SECURITY;

-- Verify afterwards (every row should show rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' ORDER BY tablename;


-- ==================== 006_store_manager_product_write.sql ====================
-- Migration 006: let store managers CREATE/EDIT their own products
-- Run in Supabase SQL Editor after migration 005.
--
-- Until now managers could only UPDATE existing products (products_manager_write)
-- and READ their catalogue (004). They could not INSERT a product, nor write
-- product_colors / product_variants at all. This unblocks the Add Product (#4)
-- and Edit Product (#5) screens. All policies are scoped to products the manager
-- owns via is_store_manager_of(store_id).

-- PRODUCTS: a manager can create products for a store they manage.
CREATE POLICY products_manager_insert ON products FOR INSERT
  WITH CHECK (is_store_manager_of(store_id));

-- PRODUCT COLORS: full write (insert/update/delete) for the manager's products.
CREATE POLICY colors_manager_write ON product_colors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- PRODUCT VARIANTS: full write for the manager's products.
CREATE POLICY variants_manager_write ON product_variants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));


-- ==================== 007_order_item_prepared.sql ====================
-- Migration 007: let a store mark its own order line-items "ready for pickup"
-- Run in Supabase SQL Editor after migration 006.
--
-- Orders are multi-store (one order can contain items from several stores), so
-- the "ready" state lives per LINE ITEM, not per order. A store flips this flag
-- via the set_order_item_prepared() RPC below — NOT a broad UPDATE policy — so a
-- store manager can only toggle prepared_at on their own items and can never
-- touch price_at_order, the customer's keep/return decision, etc.

-- 1. The flag: NULL = not prepared; a timestamp = marked ready at that time.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;

-- 2. Guarded toggle. SECURITY DEFINER runs as the owner (bypassing RLS), but the
--    explicit is_store_manager_of() check (auth.uid() still = the caller) ensures
--    only the managing store can change its own item.
CREATE OR REPLACE FUNCTION set_order_item_prepared(p_item_id UUID, p_ready BOOLEAN)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.id = p_item_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to update this order item';
  END IF;

  UPDATE order_items
  SET prepared_at = CASE WHEN p_ready THEN NOW() ELSE NULL END
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Allow logged-in users to call it (the function itself enforces ownership).
GRANT EXECUTE ON FUNCTION set_order_item_prepared(UUID, BOOLEAN) TO authenticated;


-- ==================== 008_store_profile_staff.sql ====================
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


-- ==================== 009_keep_payment.sql ====================
-- Migration 009: per-item keep-payment (Razorpay, customer panel #13)
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Prerequisite: migration 002 (try-loop: payments table) must already be applied.
--
-- WHY A SECURITY DEFINER RPC:
--   The customer app holds only the ANON key (no service-role, per the hard rules).
--   RLS lets a customer INSERT/SELECT their own `payments` rows but NOT UPDATE them.
--   Marking a payment "success" must therefore happen through a guarded function that
--   cannot be forged by a client — so this RPC re-verifies the Razorpay HMAC signature
--   *inside Postgres* before writing. A direct/forged RPC call without a valid signature
--   (which requires the secret) is rejected. Same guarded-RPC pattern as the Store panel.
--
-- ONE-TIME MANUAL STEP — store the Razorpay key SECRET in Supabase Vault (never committed).
-- (Supabase blocks ALTER DATABASE/ROLE for the SQL-editor role, so we use Vault.)
--   SELECT vault.create_secret('<your_razorpay_test_secret>', 'razorpay_key_secret', 'Razorpay key secret');
--   -- verify it stored:
--   SELECT name FROM vault.secrets WHERE name = 'razorpay_key_secret';
--   At deployment, rotate to the LIVE secret with:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'razorpay_key_secret'), '<live_secret>');

-- ============================================================
-- pgcrypto provides hmac() for in-DB signature verification.
-- On Supabase it normally already exists in the `extensions` schema (no-op here).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- Map each payment to the specific kept item it settles
-- (payments was order-scoped; per-item flow needs item granularity)
-- ============================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_item_id ON payments(order_item_id);

-- ============================================================
-- confirm_keep_payment: verify Razorpay signature, then mark
-- the payment paid and flip the kept item to 'keep'.
-- Called by the customer server action AFTER Razorpay checkout succeeds.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- include `extensions` so pgcrypto's hmac() resolves (Supabase installs it there, not public)
SET search_path = public, extensions
AS $$
DECLARE
  v_secret   TEXT;
  v_expected TEXT;
  v_payment  payments%ROWTYPE;
BEGIN
  -- Read the Razorpay secret from Vault (decrypted on read; only the definer can see it).
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'razorpay_key_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'razorpay secret not configured (create vault secret razorpay_key_secret)';
  END IF;

  -- Razorpay signs: HMAC_SHA256(razorpay_order_id || '|' || razorpay_payment_id), hex digest.
  v_expected := encode(
    hmac(p_razorpay_order_id || '|' || p_razorpay_payment_id, v_secret, 'sha256'),
    'hex'
  );

  IF v_expected IS DISTINCT FROM p_razorpay_signature THEN
    RAISE EXCEPTION 'invalid payment signature';
  END IF;

  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Ownership: caller must own the order this payment belongs to.
  -- (SECURITY DEFINER bypasses RLS, so we check ownership explicitly.)
  IF NOT EXISTS (
    SELECT 1 FROM orders o
     WHERE o.id = v_payment.order_id AND o.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  -- Idempotent: a duplicate confirm is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = p_razorpay_signature,
         paid_at             = NOW()
   WHERE id = v_payment.id;

  -- Flip the specific kept item now that it's paid for.
  IF v_payment.order_item_id IS NOT NULL THEN
    UPDATE order_items
       SET decision = 'keep', decision_at = NOW()
     WHERE id = v_payment.order_item_id;
  END IF;

  -- Mark the order paid once no kept item is left unpaid.
  UPDATE orders o
     SET payment_status = 'paid'
   WHERE o.id = v_payment.order_id
     AND NOT EXISTS (
       SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.decision = 'keep'
          AND NOT EXISTS (
            SELECT 1 FROM payments p
             WHERE p.order_item_id = oi.id AND p.status = 'success'
          )
     );
END;
$$;

-- Only logged-in customers (and admins) may call it; the function checks ownership itself.
REVOKE ALL ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) TO authenticated;


-- ==================== 010_restore_try_loop_policies.sql ====================
-- Migration 010: restore RLS policies for the try-loop tables.
-- Run in the Supabase SQL Editor.
--
-- WHY: migration 002 created try_sessions / returns / payments / payouts AND their
-- RLS policies, but in the live DB the TABLES exist with RLS enabled while the
-- POLICIES are missing (e.g. `SELECT ... FROM pg_policies WHERE tablename='try_sessions'`
-- returns nothing). RLS-enabled + no-policy = deny-all, which is why placing an order
-- fails with "new row violates row-level security policy for table try_sessions".
--
-- This re-creates exactly the policies from migration 002. DROP IF EXISTS first makes
-- it idempotent and safe to run even where some policies already exist.
-- Depends on helper functions is_admin() and is_store_manager_of() (from schema.sql).

-- ── try_sessions ──────────────────────────────────────────
DROP POLICY IF EXISTS try_sessions_select    ON try_sessions;
DROP POLICY IF EXISTS try_sessions_insert    ON try_sessions;
DROP POLICY IF EXISTS try_sessions_admin_all ON try_sessions;

CREATE POLICY try_sessions_select ON try_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR is_admin())
  ));
CREATE POLICY try_sessions_insert ON try_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY try_sessions_admin_all ON try_sessions FOR ALL USING (is_admin());

-- ── returns ───────────────────────────────────────────────
DROP POLICY IF EXISTS returns_select    ON returns;
DROP POLICY IF EXISTS returns_insert    ON returns;
DROP POLICY IF EXISTS returns_update    ON returns;
DROP POLICY IF EXISTS returns_admin_all ON returns;

CREATE POLICY returns_select ON returns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR is_admin())
  ));
CREATE POLICY returns_insert ON returns FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY returns_update ON returns FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY returns_admin_all ON returns FOR ALL USING (is_admin());

-- ── payments ──────────────────────────────────────────────
DROP POLICY IF EXISTS payments_select    ON payments;
DROP POLICY IF EXISTS payments_insert    ON payments;
DROP POLICY IF EXISTS payments_admin_all ON payments;

CREATE POLICY payments_select ON payments FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY payments_admin_all ON payments FOR ALL USING (is_admin());

-- ── payouts ───────────────────────────────────────────────
DROP POLICY IF EXISTS payouts_select    ON payouts;
DROP POLICY IF EXISTS payouts_admin_all ON payouts;

CREATE POLICY payouts_select ON payouts FOR SELECT
  USING (is_admin() OR is_store_manager_of(store_id));
CREATE POLICY payouts_admin_all ON payouts FOR ALL USING (is_admin());

-- Verify afterwards (should list policies for all four tables):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('try_sessions','returns','payments','payouts')
--   ORDER BY tablename, policyname;


-- ==================== 011_system_settings.sql ====================
-- Migration 011: system_settings (Admin panel #19)
-- Run in Supabase SQL Editor after migration 010. Idempotent — safe to re-run.
--
-- Replaces the mock Admin > System Settings screen (toast-only, persisted nothing)
-- with a real singleton config row. CLAUDE.md requires the commission rate and the
-- try-window duration to be config values, not hardcoded constants — this is their
-- source of truth. The customer try-timer and the (future) Razorpay payout math read
-- from here; admin writes via the service-role client.
--
-- try-window is stored in MINUTES (not hours) to survive the pending doorstep pivot
-- from 24h at-home (1440) to ~5–7 min on-the-spot.

-- ---- Singleton settings row -----------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  id                  SMALLINT      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- General
  site_name           VARCHAR       NOT NULL DEFAULT 'Fitzo',
  contact_email       VARCHAR       NOT NULL DEFAULT 'support@fitzo.in',
  support_phone       VARCHAR       NOT NULL DEFAULT '',
  -- Delivery & try-on
  try_window_minutes  INTEGER       NOT NULL DEFAULT 1440 CHECK (try_window_minutes >= 1),
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 49   CHECK (delivery_fee >= 0),
  free_delivery_above NUMERIC(10,2) NOT NULL DEFAULT 999  CHECK (free_delivery_above >= 0),
  -- Commission (percent)
  commission_rate     NUMERIC(5,2)  NOT NULL DEFAULT 15   CHECK (commission_rate >= 0 AND commission_rate <= 100),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by          UUID          REFERENCES users(id) ON DELETE SET NULL
);

-- Seed the single row (no-op if it already exists).
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---- RLS -------------------------------------------------------------------
-- Any signed-in user may READ (store Earnings needs commission_rate, the customer
-- try-timer needs try_window_minutes); only admins may WRITE.
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_settings_select ON system_settings;
CREATE POLICY system_settings_select ON system_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS system_settings_admin_all ON system_settings;
CREATE POLICY system_settings_admin_all ON system_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---- updated_at trigger (reuses the shared function from schema.sql) --------
DROP TRIGGER IF EXISTS set_updated_at_system_settings ON system_settings;
CREATE TRIGGER set_updated_at_system_settings
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ==================== 012_complaints.sql ====================
-- Migration 012: complaints / support tickets (Admin panel #13)
-- Run in Supabase SQL Editor after migration 011. Idempotent.
--
-- Backs Admin > Complaints & Support. Customers (or staff) file complaints; admins
-- triage, respond, and resolve. Customer-side submission UI is separate (customer panel).

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaints (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id)  ON DELETE SET NULL,
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  subject        VARCHAR(255) NOT NULL,
  message        TEXT NOT NULL,
  status         complaint_status   NOT NULL DEFAULT 'open',
  priority       complaint_priority NOT NULL DEFAULT 'normal',
  admin_response TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_status     ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

-- ---- RLS: admins manage all; a user can read + file their own --------------
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS complaints_admin_all ON complaints;
CREATE POLICY complaints_admin_all ON complaints FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS complaints_select_own ON complaints;
CREATE POLICY complaints_select_own ON complaints FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS complaints_insert_own ON complaints;
CREATE POLICY complaints_insert_own ON complaints FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- updated_at trigger (reuses the shared function) -----------------------
DROP TRIGGER IF EXISTS set_updated_at_complaints ON complaints;
CREATE TRIGGER set_updated_at_complaints
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ==================== 013_content_blocks.sql ====================
-- Migration 013: content_blocks (Admin panel #15 — CMS)
-- Run in Supabase SQL Editor after migration 012. Idempotent.
--
-- Backs Admin > Content Management. Editable content the customer site can read
-- (banners, static pages, FAQs, announcements). Published blocks are world-readable;
-- only admins write.

DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('page', 'banner', 'faq', 'announcement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS content_blocks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  type         content_type NOT NULL DEFAULT 'page',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_type ON content_blocks(type);

-- ---- RLS: anyone reads published; admins manage --------------------------
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_blocks_public_read ON content_blocks;
CREATE POLICY content_blocks_public_read ON content_blocks FOR SELECT USING (is_published OR is_admin());

DROP POLICY IF EXISTS content_blocks_admin_all ON content_blocks;
CREATE POLICY content_blocks_admin_all ON content_blocks FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---- updated_at trigger (reuses the shared function) ---------------------
DROP TRIGGER IF EXISTS set_updated_at_content_blocks ON content_blocks;
CREATE TRIGGER set_updated_at_content_blocks
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ==================== 014_agent_panel.sql ====================
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


-- ==================== 015_auto_provision_users.sql ====================
-- Migration 015: auto-provision public.users (+ a riders row for riders) on signup.
-- Run once in the Supabase SQL Editor.
--
-- WHY: signup only writes to auth.users. The customer app back-fills its public.users
-- row in the OAuth callback, but the agent app can't (with email-confirm on there's no
-- session right after signUp, so RLS blocks a client insert) — so a freshly-signed-up
-- rider had NO public.users row and NO riders row, was invisible in Admin > Riders, and
-- could only be onboarded by hand-writing SQL. This trigger removes that manual step:
-- anyone who signs up immediately gets the right rows, and a rider shows up in Admin
-- ready to be verified with one click. (Standard Supabase handle_new_user pattern.)

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_name text;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    ''
  );

  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'rider' THEN
    INSERT INTO public.riders (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- One-time back-fill: provision rows for anyone who already signed up before this
-- migration (e.g. the test rider that previously needed a manual INSERT).
INSERT INTO public.users (id, email, name, role)
SELECT au.id, au.email,
       COALESCE(NULLIF(au.raw_user_meta_data->>'name',''), NULLIF(au.raw_user_meta_data->>'full_name',''), ''),
       COALESCE((au.raw_user_meta_data->>'role')::user_role, 'customer')
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.riders (user_id)
SELECT u.id FROM public.users u
WHERE u.role = 'rider'
ON CONFLICT (user_id) DO NOTHING;


-- ==================== 016_store_confirm_order.sql ====================
-- Migration 016: gate the delivery (and the rider hand-off) on the STORE
-- confirming the order, instead of auto-creating a delivery at checkout.
-- Run once in the Supabase SQL Editor after migration 015 (auto-provision).
--
-- WHY: migration 014 (agent panel) created the delivery row in an AFTER INSERT trigger on
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


-- ==================== 017_rider_profile.sql ====================
-- Migration 017: Agent panel — rider self-service profile edits.
-- Run in the Supabase SQL Editor (after 014..016).
--
-- The agent panel lets a rider edit their own vehicle type/number from Settings.
-- We route this through a guarded SECURITY DEFINER RPC (same pattern as every
-- other rider write) instead of a broad table UPDATE policy.

-- ============================================================
-- Guarded profile update — a rider can only edit safe, self-owned fields.
-- (is_verified / rating / total_deliveries stay admin/system-owned.)
-- ============================================================
CREATE OR REPLACE FUNCTION rider_update_profile(
  p_vehicle_type text,
  p_vehicle_number text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE riders
     SET vehicle_type   = p_vehicle_type::vehicle_type,
         vehicle_number = NULLIF(btrim(p_vehicle_number), '')
   WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not a rider'; END IF;
END; $$;

REVOKE ALL ON FUNCTION rider_update_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_update_profile(text, text) TO authenticated;

-- ============================================================
-- Security fix: migration 014 (agent panel) added `riders_update_own` as a broad
-- FOR UPDATE policy with no WITH CHECK, which would let a rider flip their own
-- is_verified flag straight from the client. All legitimate rider writes now go
-- through SECURITY DEFINER RPCs (set_availability, update_profile), so the broad
-- policy is no longer needed — drop it to close the privilege-escalation path.
-- ============================================================
DROP POLICY IF EXISTS riders_update_own ON riders;


-- ==================== 018_realtime_orders.sql ====================
-- Migration 018: enable Supabase Realtime on orders + order_items
-- Run in Supabase SQL Editor after migration 017.
-- (Already applied earlier as "009_realtime_orders" — renumbered to 018 to avoid
--  filename clashes with the agent-panel migrations; re-running is idempotent.)
--
-- Powers the live "new order" pop-up alerts in the Admin and Store panels.
-- Realtime delivers INSERT events only to clients that can SELECT the row, so
-- existing RLS does the routing for free:
--   • Admin   → subscribes to `orders`      (is_admin sees all)
--   • Store   → subscribes to `order_items` (manager-read RLS, migration 004,
--               scopes to that store's own line items)
--
-- Idempotent: skips tables already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  END IF;
END $$;

-- Realtime needs the full row to evaluate RLS on changes.
ALTER TABLE orders      REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;


-- ==================== 019_finalize_order.sql ====================
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


-- ==================== 020_agent_payouts_alerts.sql ====================
-- Migration 020: agent (rider) payouts ledger + realtime tuning for agent job alerts
-- Run in Supabase SQL Editor after migration 019.
--
-- Two unrelated-but-small things bundled (both idempotent):
--   1. `agent_payouts` — a per-rider, per-order payout ledger so Admin can settle
--      rider earnings (Σ delivery_fee on completed deliveries) the same way the
--      `payouts` table settles store revenue. Mirrors `payouts` 1:1 (002_try_loop).
--   2. REPLICA IDENTITY FULL on `deliveries` so the agent panel's live "new job"
--      pop-up fires: admin assigns by UPDATEing deliveries.rider_id (NULL -> rider).
--      Realtime needs the full old+new image to evaluate RLS on that transition
--      (the OLD row wasn't visible to the rider; the NEW one is). `deliveries` is
--      already in the supabase_realtime publication (migration 014).
-- ============================================================

-- 1. agent_payouts ledger ------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_payouts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id   UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount     DECIMAL(10, 2) NOT NULL,
  status     payout_status NOT NULL DEFAULT 'paid',
  paid_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rider_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_rider_id ON agent_payouts(rider_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_order_id ON agent_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_status   ON agent_payouts(status);

ALTER TABLE agent_payouts ENABLE ROW LEVEL SECURITY;

-- Admin manages everything; a rider may read only their own payout rows.
DROP POLICY IF EXISTS agent_payouts_admin_all ON agent_payouts;
CREATE POLICY agent_payouts_admin_all ON agent_payouts FOR ALL USING (is_admin());

DROP POLICY IF EXISTS agent_payouts_select_rider ON agent_payouts;
CREATE POLICY agent_payouts_select_rider ON agent_payouts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM riders r
    WHERE r.id = agent_payouts.rider_id AND r.user_id = auth.uid()
  )
);

-- 2. Realtime: full row image so RLS can route the assign-UPDATE to the rider ---
ALTER TABLE deliveries REPLICA IDENTITY FULL;


-- ==================== 021_agent_job_notifications.sql ====================
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


-- ==================== 022_store_order_notifications.sql ====================
-- Migration 022: reliable "new order" signal for the STORE panel
-- Run in Supabase SQL Editor after migration 021.
--
-- WHY: the store new-order pop-up subscribed to `order_items` INSERT and leaned on
-- the RLS policy `order_items_manager_select` to route only that store's lines. But
-- that policy is a JOIN through `products` (is_store_manager_of(p.store_id)), and
-- Supabase Realtime can't reliably evaluate a join-based policy to decide who gets a
-- postgres_changes event — so the store stopped receiving the pop-up. (Admin still
-- works: its policy is a plain is_admin(). The agent was moved to notifications in
-- migration 021 for the same reason.)
--
-- FIX: same born-visible pattern. When an order line lands, a trigger inserts a
-- `notifications` row owned by each manager of that line's store (deduped per
-- order). notifications has the simple `user_id = auth.uid()` policy Realtime can
-- route, and it's already on the publication (migration 021). The store panel then
-- subscribes to its own notifications instead of order_items.
--
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_store_on_new_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_order_number TEXT;
  m RECORD;
BEGIN
  SELECT store_id INTO v_store_id FROM products WHERE id = NEW.product_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_number INTO v_order_number FROM orders WHERE id = NEW.order_id;

  FOR m IN
    SELECT user_id FROM store_managers WHERE store_id = v_store_id AND is_active = true
  LOOP
    -- One new-order notification per manager per order (multi-item orders fire the
    -- trigger once per line; only the first creates the row).
    IF NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.user_id
        AND n.data->>'kind' = 'new_store_order'
        AND n.data->>'order_id' = NEW.order_id::text
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        m.user_id,
        'order_update',
        'New order',
        'Order ' || COALESCE(v_order_number, '') || ' has items from your store.',
        jsonb_build_object('kind', 'new_store_order', 'order_id', NEW.order_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_store_on_new_order_item ON order_items;
CREATE TRIGGER trg_notify_store_on_new_order_item
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_store_on_new_order_item();


-- ==================== 023_agent_try_notifications.sql ====================
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


-- ==================== 024_rider_self_serve.sql ====================
-- Migration 024: rider self-serve delivery claiming (no admin assignment needed)
-- Run in Supabase SQL Editor after migration 023.
--
-- NEW FLOW: customer orders -> STORE confirms (creates the delivery, rider_id NULL)
-- -> the delivery is offered to ALL online verified riders, who see it and tap
-- Accept. First to accept CLAIMS it (atomic); the rest see "just taken". Admin
-- assignment still works as an override but is no longer required.
--
-- Both functions are SECURITY DEFINER so we don't need to widen delivery RLS to
-- expose unclaimed deliveries — the functions themselves gate on "verified rider".
-- Idempotent.
-- ============================================================

-- The offer feed: unclaimed deliveries for confirmed orders. Only a verified
-- rider gets rows; everyone else gets an empty set.
CREATE OR REPLACE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_address JSONB,
  item_count   BIGINT,
  final_amount NUMERIC,
  delivery_fee NUMERIC,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM riders r WHERE r.user_id = auth.uid() AND r.is_verified = true
  ) THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         d.drop_address,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.final_amount,
         o.delivery_fee,
         o.created_at            -- deliveries has no created_at; use the order's
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'          -- created-but-unclaimed
    AND o.status = 'confirmed'         -- store has confirmed it
  ORDER BY o.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;

-- Atomic claim: the first verified rider to call this wins. The
-- `rider_id IS NULL` guard + row lock makes a double-accept impossible.
CREATE OR REPLACE FUNCTION rider_claim_delivery(p_delivery_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
  v_order UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RAISE EXCEPTION 'not a verified rider';
  END IF;

  UPDATE deliveries
     SET rider_id = v_rider, status = 'accepted', accepted_at = now()
   WHERE id = p_delivery_id
     AND rider_id IS NULL
     AND status = 'assigned'
  RETURNING order_id INTO v_order;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'This job was just taken by another rider';
  END IF;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION rider_claim_delivery(UUID) TO authenticated;


-- ==================== 025_rider_decline_cooldown.sql ====================
-- Migration 025: rider decline cooldown + admin visibility helpers
-- Run in Supabase SQL Editor after migration 024.
--
-- When a rider declines an offered delivery we don't want it flashing back into
-- their feed on the next 7s poll (or after a refresh). Record the decline and hide
-- that job from THAT rider for a cooldown window. It still stays offered to every
-- other online rider, and it re-surfaces to the decliner after the cooldown in case
-- nobody else took it. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_declines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id    UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  declined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rider_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_declines_lookup
  ON delivery_declines(rider_id, delivery_id, declined_at);

ALTER TABLE delivery_declines ENABLE ROW LEVEL SECURITY;

-- A rider manages only their own declines; admins can read all.
DROP POLICY IF EXISTS delivery_declines_rider ON delivery_declines;
CREATE POLICY delivery_declines_rider ON delivery_declines FOR ALL USING (
  EXISTS (SELECT 1 FROM riders r WHERE r.id = delivery_declines.rider_id AND r.user_id = auth.uid())
  OR is_admin()
);

-- Record a decline (upsert so re-declining resets the cooldown).
CREATE OR REPLACE FUNCTION rider_decline_delivery(p_delivery_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RAISE EXCEPTION 'not a verified rider';
  END IF;

  INSERT INTO delivery_declines (rider_id, delivery_id)
  VALUES (v_rider, p_delivery_id)
  ON CONFLICT (rider_id, delivery_id)
  DO UPDATE SET declined_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION rider_decline_delivery(UUID) TO authenticated;

-- Rebuild the offer feed to hide jobs this rider declined within the cooldown
-- (10 minutes). Same shape as migration 024.
CREATE OR REPLACE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_address JSONB,
  item_count   BIGINT,
  final_amount NUMERIC,
  delivery_fee NUMERIC,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         d.drop_address,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.final_amount,
         o.delivery_fee,
         o.created_at            -- deliveries has no created_at; use the order's
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.delivery_id = d.id
        AND dd.rider_id = v_rider
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;


-- ==================== 026_fix_available_deliveries_created_at.sql ====================
-- Migration 026: fix available_deliveries() — deliveries has no created_at column
-- Run in Supabase SQL Editor after migration 025.
--
-- Bug: migrations 024/025 selected `d.created_at`, but the deliveries table has no
-- `created_at` (it has assigned_at/accepted_at/…). The RPC errored with
-- "column d.created_at does not exist", so the rider offer feed showed that error
-- and no jobs. Fix: use the ORDER's created_at (which exists) as the offer time.
-- Idempotent (CREATE OR REPLACE). Same shape/logic as 025, only the column fixed.
-- ============================================================

CREATE OR REPLACE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_address JSONB,
  item_count   BIGINT,
  final_amount NUMERIC,
  delivery_fee NUMERIC,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         d.drop_address,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.final_amount,
         o.delivery_fee,
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.delivery_id = d.id
        AND dd.rider_id = v_rider
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;


-- ==================== 027_try_window_expiry.sql ====================
-- Migration 027: resolve expired try windows so orders never hang
-- Run in Supabase SQL Editor after migration 026.
--
-- Today finalize_order_if_decided() only completes an order once EVERY item is
-- decided. If the window ends with items still pending (rider leaves, customer
-- walks off), the order + try session hang open forever. This migration:
--   1. auto_return_pending_items() — flips undecided items to 'return' + records
--      return rows (the customer hands them back to the waiting rider anyway).
--   2. rider_complete_delivery() — now auto-returns pending items before closing,
--      so the rider's "Collect returns & complete" always leaves a clean state.
--   3. expire_order_if_due() — clients call this when their countdown hits 0 to
--      self-heal a single order (safe: only acts on a genuinely-expired window).
--   4. expire_try_windows() — a global sweep for a scheduled job (pg_cron), for
--      the fully-abandoned case where nobody is watching.
-- Idempotent.
-- ============================================================

-- 1. Turn every still-pending item on an order into a return (+ a returns row).
CREATE OR REPLACE FUNCTION auto_return_pending_items(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_items
     SET decision = 'return', decision_at = now()
   WHERE order_id = p_order_id AND decision = 'pending';

  INSERT INTO returns (order_id, order_item_id, reason)
  SELECT oi.order_id, oi.id, 'Auto-returned: try window ended'
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.decision = 'return'
    AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.order_item_id = oi.id);
END;
$$;

-- 2. Rider completion auto-resolves anything left pending.
CREATE OR REPLACE FUNCTION rider_complete_delivery(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id AND rider_id = v_rider
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot complete delivery'; END IF;

  PERFORM auto_return_pending_items(v_order);

  UPDATE orders SET status = 'completed' WHERE id = v_order;
  UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;

-- 3. Per-order self-heal — safe to grant: only acts if the window is truly expired.
CREATE OR REPLACE FUNCTION expire_order_if_due(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_due BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM try_sessions
    WHERE order_id = p_order_id AND status = 'active' AND deadline_at < now()
  ) INTO v_due;
  IF NOT v_due THEN
    RETURN false;
  END IF;

  PERFORM auto_return_pending_items(p_order_id);
  UPDATE try_sessions SET status = 'completed' WHERE order_id = p_order_id AND status = 'active';
  UPDATE orders SET status = 'completed' WHERE id = p_order_id AND status <> 'completed';
  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE order_id = p_order_id AND status NOT IN ('completed', 'failed');
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_order_if_due(UUID) TO authenticated;

-- 4. Global sweep for a scheduled job (NOT granted to clients).
CREATE OR REPLACE FUNCTION expire_try_windows()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN
    SELECT order_id FROM try_sessions WHERE status = 'active' AND deadline_at < now()
  LOOP
    PERFORM auto_return_pending_items(r.order_id);
    UPDATE try_sessions SET status = 'completed' WHERE order_id = r.order_id;
    UPDATE orders SET status = 'completed' WHERE id = r.order_id AND status <> 'completed';
    UPDATE deliveries SET status = 'completed', completed_at = now()
     WHERE order_id = r.order_id AND status NOT IN ('completed', 'failed');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION expire_try_windows() FROM PUBLIC;

-- OPTIONAL — run the sweep every minute (needs the pg_cron extension enabled in
-- the Supabase dashboard → Database → Extensions). Uncomment to enable:
--   SELECT cron.schedule('expire-try-windows', '* * * * *', $$SELECT expire_try_windows()$$);


-- ==================== 028_delivery_recovery.sql ====================
-- Migration 028: recover stuck deliveries (rider release + auto-release on offline)
-- Run in Supabase SQL Editor after migration 027.
--
-- A rider who claims a job then goes offline / closes the app used to freeze that
-- order — it was no longer offered to anyone and only an admin override could move
-- it. This adds:
--   1. rider_release_delivery() — a rider hands an un-picked-up job back to the
--      pool (with a short cooldown so it doesn't bounce straight back to them).
--   2. rider_set_availability() — going Offline auto-releases any un-picked-up jobs
--      the rider was holding, back into the pool for other riders.
-- (Admin release/reassign is handled in the admin app via the admin RLS.)
-- Idempotent.
-- ============================================================

-- 1. Rider voluntarily returns an accepted (not-yet-picked-up) job to the pool.
CREATE OR REPLACE FUNCTION rider_release_delivery(p_delivery_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a verified rider'; END IF;

  UPDATE deliveries
     SET rider_id = NULL, status = 'assigned', accepted_at = NULL
   WHERE id = p_delivery_id AND rider_id = v_rider AND status = 'accepted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'can only release a job you have accepted but not yet picked up';
  END IF;

  -- Short cooldown so the released job doesn't immediately re-offer to this rider.
  INSERT INTO delivery_declines (rider_id, delivery_id)
  VALUES (v_rider, p_delivery_id)
  ON CONFLICT (rider_id, delivery_id) DO UPDATE SET declined_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION rider_release_delivery(UUID) TO authenticated;

-- 2. Going offline auto-releases un-picked-up jobs so nothing stays stuck.
CREATE OR REPLACE FUNCTION rider_set_availability(p_available boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider UUID;
BEGIN
  UPDATE riders SET is_available = p_available WHERE user_id = auth.uid()
   RETURNING id INTO v_rider;
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a rider'; END IF;

  IF NOT p_available THEN
    -- Release only jobs accepted but not yet picked up (a picked-up rider still
    -- physically has the items — that's an admin/support case, not auto-release).
    UPDATE deliveries
       SET rider_id = NULL, status = 'assigned', accepted_at = NULL
     WHERE rider_id = v_rider AND status = 'accepted';
  END IF;
END; $$;


-- ==================== 029_store_onboarding.sql ====================
-- Migration 029: real store onboarding (self-serve signup → wizard → admin approval)
-- Run once in the Supabase SQL Editor after migration 028. Idempotent.
--
-- WHAT THIS ENABLES (Store panel rework, week of 2026-07-02):
--   * A store manager can SIGN UP themselves (no more hand-created accounts). Signup
--     auto-provisions a DRAFT store + the store_managers link via handle_new_user.
--   * The store fills an onboarding wizard (business + pickup + bank/UPI + GST/PAN),
--     then SUBMITS for review. Admin approves → store goes live (is_active/is_verified).
--   * Sensitive KYC/bank details live in a SEPARATE private table (store_business_details),
--     NOT on `stores`, because `stores` is world-readable (customer storefront reads it).
--
-- SECURITY: same guarded SECURITY DEFINER pattern as 007/008 — the store fills its own
-- DRAFT, but can NEVER self-set is_verified / is_active / onboarding_status='approved'.
-- Only admin (service-role, stores_admin_all) flips those.

-- ============================================================
-- 1. Onboarding status enum + new columns on `stores`
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_onboarding_status') THEN
    CREATE TYPE store_onboarding_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE stores ADD COLUMN IF NOT EXISTS category          VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_status store_onboarding_status NOT NULL DEFAULT 'draft';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;

-- Back-fill: any store that existed before onboarding (seeded/verified test stores)
-- is treated as already approved so it keeps working and isn't locked out of the panel.
UPDATE stores SET onboarding_status = 'approved'
WHERE onboarding_status = 'draft' AND (is_verified = true OR is_active = true);

-- ============================================================
-- 2. Private business/KYC/bank details (never world-readable)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_business_details (
  store_id            UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  legal_name          VARCHAR(255),
  entity_type         VARCHAR(50),   -- individual | proprietorship | partnership | pvt_ltd | llp
  gst_number          VARCHAR(15),
  pan_number          VARCHAR(10),
  bank_account_name   VARCHAR(255),
  bank_account_number VARCHAR(30),
  bank_ifsc           VARCHAR(11),
  upi_id              VARCHAR(100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE store_business_details ENABLE ROW LEVEL SECURITY;

-- Read: only the store's own manager or an admin. NEVER public / anon.
DROP POLICY IF EXISTS store_business_details_select ON store_business_details;
CREATE POLICY store_business_details_select ON store_business_details
  FOR SELECT USING (is_store_manager_of(store_id) OR is_admin());

-- Admin full access (service-role + admin session). Store-side writes go through the
-- SECURITY DEFINER RPC below, so there is intentionally NO store INSERT/UPDATE policy.
DROP POLICY IF EXISTS store_business_details_admin_all ON store_business_details;
CREATE POLICY store_business_details_admin_all ON store_business_details
  FOR ALL USING (is_admin());

DROP TRIGGER IF EXISTS set_store_business_details_updated_at ON store_business_details;
CREATE TRIGGER set_store_business_details_updated_at
  BEFORE UPDATE ON store_business_details
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Back-fill an (empty) details row for every existing store.
INSERT INTO store_business_details (store_id)
SELECT id FROM stores
ON CONFLICT (store_id) DO NOTHING;

-- ============================================================
-- 3. A manager must be able to read their OWN store even while it's a
--    draft (is_active = false). The base stores_select hides inactive
--    stores from everyone but admin, which would break login + the gate.
-- ============================================================
DROP POLICY IF EXISTS stores_manager_select ON stores;
CREATE POLICY stores_manager_select ON stores
  FOR SELECT USING (is_store_manager_of(id));

-- ============================================================
-- 4. Auto-provision a DRAFT store on store-manager signup
--    (extends the migration-015 handle_new_user trigger).
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role       user_role;
  v_name       text;
  v_store_name text;
  v_slug       text;
  v_store_id   uuid;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    ''
  );

  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'rider' THEN
    INSERT INTO public.riders (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF v_role = 'store_manager' THEN
    -- Only provision a fresh store if this user isn't already linked to one
    -- (guards against the trigger re-running / an admin-invited manager).
    IF NOT EXISTS (SELECT 1 FROM public.store_managers WHERE user_id = NEW.id) THEN
      v_store_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'store_name', ''), 'My Store');

      -- URL-safe slug from the store name + a short unique suffix to avoid collisions.
      v_slug := trim(both '-' from regexp_replace(lower(v_store_name), '[^a-z0-9]+', '-', 'g'));
      IF v_slug = '' THEN v_slug := 'store'; END IF;
      v_slug := v_slug || '-' || substr(md5(NEW.id::text), 1, 6);

      INSERT INTO public.stores (name, slug, contact_email, onboarding_status, is_active, is_verified)
      VALUES (v_store_name, v_slug, NEW.email, 'draft', false, false)
      RETURNING id INTO v_store_id;

      INSERT INTO public.store_managers (user_id, store_id)
      VALUES (NEW.id, v_store_id);

      INSERT INTO public.store_business_details (store_id)
      VALUES (v_store_id)
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- Trigger itself is unchanged (created in 015) but re-assert it idempotently.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. Guarded store-side writes (fill draft + submit for review)
-- ============================================================

-- Save/patch the onboarding draft: safe `stores` columns + private business details in
-- one call. Allowed only while draft or rejected (locked once submitted/approved).
-- Never touches slug / is_active / is_verified / onboarding_status.
CREATE OR REPLACE FUNCTION save_store_onboarding(
  p_store_id            UUID,
  p_name                TEXT,
  p_category            TEXT,
  p_description         TEXT,
  p_contact_email       TEXT,
  p_contact_phone       TEXT,
  p_address             TEXT,
  p_city                TEXT,
  p_pincode             TEXT,
  p_legal_name          TEXT,
  p_entity_type         TEXT,
  p_gst_number          TEXT,
  p_pan_number          TEXT,
  p_bank_account_name   TEXT,
  p_bank_account_number TEXT,
  p_bank_ifsc           TEXT,
  p_upi_id              TEXT
) RETURNS VOID AS $$
DECLARE
  v_status store_onboarding_status;
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to update this store';
  END IF;

  SELECT onboarding_status INTO v_status FROM stores WHERE id = p_store_id;
  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Onboarding is locked while under review or approved';
  END IF;

  UPDATE stores SET
    name          = COALESCE(NULLIF(p_name, ''), name),
    category      = p_category,
    description   = p_description,
    contact_email = p_contact_email,
    contact_phone = p_contact_phone,
    address       = p_address,
    city          = p_city,
    pincode       = p_pincode,
    updated_at    = NOW()
  WHERE id = p_store_id;

  INSERT INTO store_business_details AS d (
    store_id, legal_name, entity_type, gst_number, pan_number,
    bank_account_name, bank_account_number, bank_ifsc, upi_id
  ) VALUES (
    p_store_id, p_legal_name, p_entity_type, upper(NULLIF(p_gst_number, '')), upper(NULLIF(p_pan_number, '')),
    p_bank_account_name, p_bank_account_number, upper(NULLIF(p_bank_ifsc, '')), p_upi_id
  )
  ON CONFLICT (store_id) DO UPDATE SET
    legal_name          = EXCLUDED.legal_name,
    entity_type         = EXCLUDED.entity_type,
    gst_number          = EXCLUDED.gst_number,
    pan_number          = EXCLUDED.pan_number,
    bank_account_name   = EXCLUDED.bank_account_name,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc           = EXCLUDED.bank_ifsc,
    upi_id              = EXCLUDED.upi_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_store_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Submit the draft for admin review. Validates the essential fields server-side so a
-- half-filled store can't reach the review queue. Moves draft/rejected → submitted.
CREATE OR REPLACE FUNCTION submit_store_onboarding(p_store_id UUID)
RETURNS VOID AS $$
DECLARE
  v_status store_onboarding_status;
  v_missing text[] := '{}';
  s stores%ROWTYPE;
  d store_business_details%ROWTYPE;
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to submit this store';
  END IF;

  SELECT * INTO s FROM stores WHERE id = p_store_id;
  v_status := s.onboarding_status;
  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'This store is already % ', v_status;
  END IF;

  SELECT * INTO d FROM store_business_details WHERE store_id = p_store_id;

  -- Essential fields for a reviewable application.
  IF COALESCE(NULLIF(s.category, ''), NULL)      IS NULL THEN v_missing := v_missing || 'category'; END IF;
  IF COALESCE(NULLIF(s.contact_phone, ''), NULL) IS NULL THEN v_missing := v_missing || 'contact phone'; END IF;
  IF COALESCE(NULLIF(s.address, ''), NULL)       IS NULL THEN v_missing := v_missing || 'pickup address'; END IF;
  IF COALESCE(NULLIF(s.city, ''), NULL)          IS NULL THEN v_missing := v_missing || 'city'; END IF;
  IF COALESCE(NULLIF(s.pincode, ''), NULL)       IS NULL THEN v_missing := v_missing || 'pincode'; END IF;
  IF d.legal_name  IS NULL OR d.legal_name  = '' THEN v_missing := v_missing || 'legal name'; END IF;
  IF d.entity_type IS NULL OR d.entity_type = '' THEN v_missing := v_missing || 'entity type'; END IF;
  IF d.pan_number  IS NULL OR d.pan_number  = '' THEN v_missing := v_missing || 'PAN'; END IF;
  -- A payout target: either full bank triplet or a UPI id.
  IF (d.upi_id IS NULL OR d.upi_id = '')
     AND (d.bank_account_number IS NULL OR d.bank_account_number = ''
          OR d.bank_ifsc IS NULL OR d.bank_ifsc = '') THEN
    v_missing := v_missing || 'payout details (bank or UPI)';
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Please complete: %', array_to_string(v_missing, ', ');
  END IF;

  UPDATE stores SET
    onboarding_status = 'submitted',
    submitted_at      = NOW(),
    rejection_reason  = NULL,
    updated_at        = NOW()
  WHERE id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_store_onboarding(UUID) TO authenticated;

-- Verify afterwards:
--   SELECT id, name, slug, onboarding_status, is_active, is_verified FROM stores;
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'store_business_details';


-- ==================== 030_product_images_upload.sql ====================
-- Migration 030: product image upload for the Store panel (rework L6)
-- Run once in the Supabase SQL Editor after migration 029. Idempotent.
--
-- WHY: the schema has had `product_images` + a `product-images` bucket comment since
-- day one, but nothing was ever wired: store managers have NO write policy on
-- `product_images` (only images_admin_all), and the bucket + its storage policies
-- were never created. This closes both gaps so the store ProductForm can upload.
--
-- Path convention for uploads: {store_id}/{product_id}/{filename} — the FIRST folder
-- is the store id, which is what the storage policies check via is_store_manager_of().

-- ============================================================
-- 1. product_images: manager write (same shape as migration 006's
--    colors/variants policies — scoped through the owning product).
-- ============================================================
DROP POLICY IF EXISTS images_manager_write ON product_images;
CREATE POLICY images_manager_write ON product_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- ============================================================
-- 2. Storage bucket (public read — product photos are public content).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Storage policies. storage.objects already has RLS enabled by Supabase.
--    Managers may only write inside their own store's folder (first path segment).
-- ============================================================
DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS product_images_manager_insert ON storage.objects;
CREATE POLICY product_images_manager_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND is_store_manager_of(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS product_images_manager_delete ON storage.objects;
CREATE POLICY product_images_manager_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND is_store_manager_of(((storage.foldername(name))[1])::uuid)
  );

-- Admin full access over the bucket (service-role bypasses RLS anyway; this covers
-- admin-session dashboard actions).
DROP POLICY IF EXISTS product_images_admin_all ON storage.objects;
CREATE POLICY product_images_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND is_admin())
  WITH CHECK (bucket_id = 'product-images' AND is_admin());

-- Verify afterwards:
--   SELECT id, public FROM storage.buckets WHERE id = 'product-images';
--   SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'product_images%';


-- ==================== 031_bulk_mark_ready.sql ====================
-- Migration 031: bulk "mark ready" — one round-trip instead of one RPC per item.
-- Run in Supabase SQL Editor after migration 030. Idempotent.
--
-- WHY: the store panel's "Mark all ready" / dashboard "Ready & confirm" used to
-- call set_order_item_prepared() (migration 007) once per line item — a
-- 10-item order was 10 sequential round-trips on store Wi-Fi. This RPC flips
-- every one of the CALLER'S OWN items in an order in a single statement.
-- Authorization is by construction: the UPDATE only touches items whose
-- product belongs to a store the caller manages (is_store_manager_of), so a
-- multi-store order can never have another store's items flipped.

CREATE OR REPLACE FUNCTION mark_order_items_prepared(p_order_id UUID, p_ready BOOLEAN DEFAULT TRUE)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Caller must manage the store of at least one item in this order
  -- (same gate as store_confirm_order, migration 016).
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to update this order';
  END IF;

  UPDATE order_items oi
  SET prepared_at = CASE WHEN p_ready THEN NOW() ELSE NULL END
  FROM products p
  WHERE p.id = oi.product_id
    AND oi.order_id = p_order_id
    AND is_store_manager_of(p.store_id)
    -- only rows that actually change (keeps first-ready timestamps stable
    -- when the RPC is retried)
    AND ((p_ready AND oi.prepared_at IS NULL) OR (NOT p_ready AND oi.prepared_at IS NOT NULL));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION mark_order_items_prepared(UUID, BOOLEAN) TO authenticated;


-- ==================== 032_payouts_unique.sql ====================
-- ============================================================
-- 032: double-payout guard on the store payout ledger
--
-- `agent_payouts` has had UNIQUE (rider_id, order_id) since migration 020,
-- but `payouts` (migration 002) never got the mirror constraint — so a
-- double-click / concurrent "Record payout" could insert duplicate ledger
-- rows and overstate what a store was paid. Dedupe, then add the constraint.
--
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1. Remove exact duplicates, keeping the earliest row per (store_id, order_id).
DELETE FROM payouts p
USING payouts older
WHERE p.store_id = older.store_id
  AND p.order_id = older.order_id
  AND (p.created_at > older.created_at
       OR (p.created_at = older.created_at AND p.ctid > older.ctid));

-- 2. Add the unique constraint (skip if it already exists).
DO $$
BEGIN
  ALTER TABLE payouts ADD CONSTRAINT payouts_store_order_unique UNIQUE (store_id, order_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;


-- ==================== 033_agent_delivery_flow.sql ====================
-- Migration 033: agent rework Phase 2 — the delivery flow made real.
-- Run in the Supabase SQL Editor after migration 032. Idempotent.
--
-- What this fixes (see docs/AGENT_PANEL_AUDIT.md):
--   A/C2  Rider was never told WHERE to pick up: deliveries.pickup_address existed
--         but nothing populated it. store_confirm_order() now stamps it (items
--         exist at confirm time; the order-INSERT trigger was removed in 016).
--   D1    available_deliveries() leaked full customer PII (name/phone/street) to
--         every polling rider pre-claim → now returns a redacted drop_area only.
--   B5    No concurrent-job cap → the feed is now empty while a rider holds an
--         active job (cap = 1, matching real delivery apps at this scale).
--   B7    No handover verification → 4-digit delivery OTP: shown to the customer
--         on their tracking page, entered by the rider at the door.
--   D2    rider_complete_delivery had no status guard (console-callable straight
--         after accept → instant earnings) → now requires an arrived delivery +
--         an actually-finished try window.
--   D3    rider_mark_picked_up ignored store readiness → now requires every item
--         prepared; rider_mark_delivered no longer reachable from 'accepted'.
--   C3    Bad-day path: rider_fail_delivery(reason) — rider-side terminal exit
--         (customer unreachable / can't complete) that files into Admin > Complaints.
--
-- ⚠️ Contract changes (flag for Jay):
--   • available_deliveries() return shape changed: drop_address → drop_area
--     (redacted), final_amount removed, + store_name/store_area/store_count.
--   • rider_mark_delivered(uuid) is DROPPED, replaced by (uuid, text) with the
--     OTP. The agent client falls back to the old call when 033 isn't applied.
--   • rider_mark_delivered now requires the new arrival step (rider_mark_arrived)
--     first; it no longer jumps straight from picked_up/accepted.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Handover OTP column + backfill for in-flight deliveries.
-- ------------------------------------------------------------
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_otp TEXT;

UPDATE deliveries
   SET delivery_otp = lpad(floor(random() * 10000)::int::text, 4, '0')
 WHERE delivery_otp IS NULL
   AND status NOT IN ('completed', 'failed');

-- ------------------------------------------------------------
-- 2. Helper: the pickup snapshot for an order — first store by name +
--    a store_count so multi-store orders are visible to the rider.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION order_pickup_snapshot(p_order_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'store_name', s.name,
    'address',    s.address,
    'city',       s.city,
    'pincode',    s.pincode,
    'phone',      s.contact_phone,
    'store_count', (SELECT count(DISTINCT p2.store_id)
                    FROM order_items oi2
                    JOIN products p2 ON p2.id = oi2.product_id
                    WHERE oi2.order_id = p_order_id)
  )
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN stores  s ON s.id = p.store_id
  WHERE oi.order_id = p_order_id
  ORDER BY s.name
  LIMIT 1;
$$;

-- Backfill pickup info onto existing in-flight deliveries that lack it.
UPDATE deliveries d
   SET pickup_address = COALESCE(order_pickup_snapshot(d.order_id), '{}'::jsonb)
 WHERE (d.pickup_address IS NULL OR d.pickup_address = '{}'::jsonb)
   AND d.status NOT IN ('completed', 'failed');

-- ------------------------------------------------------------
-- 3. store_confirm_order(): same signature + semantics as 016 (store-ownership
--    check, FOR UPDATE lock, idempotent early return) — now also stamps
--    pickup_address and generates the handover OTP at delivery creation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION store_confirm_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addr    addresses%ROWTYPE;
  v_status  order_status;
  v_addr_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to confirm this order';
  END IF;

  SELECT status, address_id INTO v_status, v_addr_id
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_status <> 'pending' THEN
    RETURN; -- already confirmed (or further along) — nothing to do
  END IF;

  UPDATE orders SET status = 'confirmed' WHERE id = p_order_id;

  IF NOT EXISTS (SELECT 1 FROM deliveries WHERE order_id = p_order_id AND type = 'delivery') THEN
    SELECT * INTO v_addr FROM addresses WHERE id = v_addr_id;
    INSERT INTO deliveries (order_id, type, status, drop_address, pickup_address, delivery_otp)
    VALUES (
      p_order_id, 'delivery', 'assigned',
      CASE WHEN v_addr.id IS NOT NULL THEN jsonb_build_object(
        'full_name', v_addr.full_name, 'phone', v_addr.phone, 'line1', v_addr.line1,
        'line2', v_addr.line2, 'landmark', v_addr.landmark, 'city', v_addr.city,
        'state', v_addr.state, 'pincode', v_addr.pincode
      ) ELSE '{}'::jsonb END,
      COALESCE(order_pickup_snapshot(p_order_id), '{}'::jsonb),
      lpad(floor(random() * 10000)::int::text, 4, '0')
    );
  END IF;
END; $$;

-- ------------------------------------------------------------
-- 4. Customer-side OTP read. Customers can't SELECT deliveries under RLS
--    (rider/admin only) — this narrow accessor returns ONLY the OTP, only to
--    the order's owner, only while the order is out for delivery.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_delivery_handover(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_otp TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND user_id = auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT d.delivery_otp INTO v_otp
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.order_id = p_order_id
    AND d.type = 'delivery'
    AND o.status = 'out_for_delivery'
  LIMIT 1;
  RETURN v_otp;
END; $$;

REVOKE ALL ON FUNCTION get_delivery_handover(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_delivery_handover(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. Offer feed v3. Changes vs 025/026:
--    • cap = 1: nothing is offered while the rider holds an active job
--    • drop_area replaces drop_address — city/pincode/landmark only; the full
--      address + phone become visible only AFTER claiming (deliveries_select RLS)
--    • store_name / store_area / store_count from the pickup snapshot
--    • final_amount removed (the rider's number is the fee, not the bill)
--    • created_at kept = the ORDER's created_at (026), so the card can show age
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS available_deliveries();
CREATE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_area    JSONB,
  item_count   BIGINT,
  delivery_fee NUMERIC,
  store_name   TEXT,
  store_area   TEXT,
  store_count  BIGINT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders r
  WHERE r.user_id = auth.uid() AND r.is_verified = true;
  IF v_rider IS NULL THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  -- One job at a time: an active delivery hides the feed entirely.
  IF EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.rider_id = v_rider
      AND d.status IN ('accepted', 'picked_up', 'en_route', 'arrived')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         jsonb_build_object(
           'city',     d.drop_address->>'city',
           'pincode',  d.drop_address->>'pincode',
           'landmark', d.drop_address->>'landmark'
         ),
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.delivery_fee,
         d.pickup_address->>'store_name',
         concat_ws(' · ', NULLIF(d.pickup_address->>'city', ''),
                          NULLIF(d.pickup_address->>'pincode', '')),
         COALESCE((d.pickup_address->>'store_count')::BIGINT, 1),
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.rider_id = v_rider
        AND dd.delivery_id = d.id
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END; $$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;

-- ------------------------------------------------------------
-- 6. Pickup now requires the store to have marked every item ready.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_mark_picked_up(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id INTO v_order
  FROM deliveries d
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'accepted';
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot mark picked up'; END IF;

  IF EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = v_order AND oi.prepared_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The store has not marked all items ready yet — check with the store staff';
  END IF;

  UPDATE deliveries SET status = 'picked_up', picked_up_at = now()
   WHERE id = p_delivery_id;
  UPDATE orders SET status = 'out_for_delivery' WHERE id = v_order;
END; $$;

-- ------------------------------------------------------------
-- 7. NEW arrival step: at the door, before handover. Delivery → 'arrived';
--    the ORDER stays out_for_delivery until the OTP handover.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_mark_arrived(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'arrived'
   WHERE id = p_delivery_id AND rider_id = v_rider
     AND status IN ('picked_up', 'en_route');
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot mark arrived'; END IF;
END; $$;

REVOKE ALL ON FUNCTION rider_mark_arrived(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_mark_arrived(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. Handover = OTP verified at the door. Replaces rider_mark_delivered(uuid).
--    Legacy deliveries with no OTP (pre-033, or admin-created) skip the check.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS rider_mark_delivered(uuid);

CREATE OR REPLACE FUNCTION rider_mark_delivered(p_delivery_id uuid, p_otp text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_otp text;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id, d.delivery_otp INTO v_order, v_otp
  FROM deliveries d
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'arrived'
  FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot mark delivered — tap "I''m at the door" first'; END IF;

  IF v_otp IS NOT NULL AND btrim(coalesce(p_otp, '')) <> v_otp THEN
    RAISE EXCEPTION 'Wrong code — ask the customer for the 4-digit code on their tracking page';
  END IF;

  UPDATE orders SET status = 'delivered' WHERE id = v_order;
END; $$;

REVOKE ALL ON FUNCTION rider_mark_delivered(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_mark_delivered(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 9. Completion guard (audit D2). Requires: the delivery is 'arrived', the try
--    window actually ran (order try_window_active), and it's genuinely over —
--    every item decided OR the deadline passed. Keeps 027's auto-return.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_complete_delivery(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_ostatus order_status; v_deadline timestamptz;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id, o.status INTO v_order, v_ostatus
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'arrived'
  FOR UPDATE OF d;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot complete delivery'; END IF;

  IF v_ostatus <> 'try_window_active' THEN
    RAISE EXCEPTION 'the try-on window has not started yet';
  END IF;

  SELECT deadline_at INTO v_deadline
  FROM try_sessions WHERE order_id = v_order;

  IF EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = v_order AND oi.decision = 'pending'
  ) AND (v_deadline IS NULL OR v_deadline > now()) THEN
    RAISE EXCEPTION 'the customer is still deciding — wait for the timer or the last decision';
  END IF;

  PERFORM auto_return_pending_items(v_order);

  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id;
  UPDATE orders SET status = 'completed' WHERE id = v_order;
  UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;

-- ------------------------------------------------------------
-- 10. Bad-day terminal exit (audit C3): the rider cannot deliver (customer
--     unreachable, wrong address, safety issue). Requires a reason; fails the
--     delivery, cancels the order, closes any try session, and FILES A
--     COMPLAINT so it lands in Admin > Complaints for review. The rider
--     physically returns the items to the store.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_fail_delivery(p_delivery_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_order_no text;
BEGIN
  v_rider := current_rider_id();
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a rider'; END IF;

  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'a short reason is required';
  END IF;

  UPDATE deliveries
     SET status = 'failed',
         completed_at = now(),
         rider_notes = left(btrim(p_reason), 500)
   WHERE id = p_delivery_id AND rider_id = v_rider
     AND status IN ('picked_up', 'en_route', 'arrived')
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'can only report a failed delivery on a job you picked up';
  END IF;

  UPDATE orders SET status = 'cancelled' WHERE id = v_order;
  UPDATE try_sessions SET status = 'expired' WHERE order_id = v_order AND status = 'active';

  SELECT order_number INTO v_order_no FROM orders WHERE id = v_order;
  INSERT INTO complaints (user_id, order_id, subject, message, priority)
  VALUES (
    auth.uid(), v_order,
    left('[Rider issue] Delivery failed — ' || coalesce(v_order_no, 'order'), 255),
    left(btrim(p_reason), 2000) || E'\n\n(Filed automatically from the rider app; items returned to the store.)',
    'high'
  );
END; $$;

REVOKE ALL ON FUNCTION rider_fail_delivery(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_fail_delivery(uuid, text) TO authenticated;


-- ==================== 034_rider_payout_details.sql ====================
-- Migration 034: agent rework Phase 3 — rider payout details (bank/UPI + PAN).
-- Run in the Supabase SQL Editor after migration 033. Idempotent.
--
-- WHY (docs/AGENT_PANEL_AUDIT.md §B2): Admin > Agent Payouts settles a ledger,
-- but there was NO destination to pay into — no rider bank/UPI anywhere.
-- Mirrors the store panel's `store_business_details` pattern (migration 029):
--   • sensitive data in its own PRIVATE table, never on world-readable rows
--   • RLS: the rider themself or an admin — nobody else, never anon
--   • rider-side writes go through ONE guarded SECURITY DEFINER RPC that
--     validates formats in-DB; there is deliberately NO rider INSERT/UPDATE
--     policy on the table.
-- Unlike stores there is no submit/approve loop — payout details just need to
-- exist (validated) for admin to pay against; verification stays the rider-
-- account gate (riders.is_verified).
-- ============================================================

CREATE TABLE IF NOT EXISTS rider_payout_details (
  rider_id            UUID PRIMARY KEY REFERENCES riders(id) ON DELETE CASCADE,
  legal_name          VARCHAR(255),  -- name as on the bank account / PAN card
  pan_number          VARCHAR(10),
  payout_method       VARCHAR(10) NOT NULL DEFAULT 'upi', -- 'upi' | 'bank'
  bank_account_name   VARCHAR(255),
  bank_account_number VARCHAR(30),
  bank_ifsc           VARCHAR(11),
  upi_id              VARCHAR(100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rider_payout_details ENABLE ROW LEVEL SECURITY;

-- Read: the rider's own row or an admin. NEVER public / anon.
DROP POLICY IF EXISTS rider_payout_details_select ON rider_payout_details;
CREATE POLICY rider_payout_details_select ON rider_payout_details
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM riders r
            WHERE r.id = rider_payout_details.rider_id AND r.user_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS rider_payout_details_admin_all ON rider_payout_details;
CREATE POLICY rider_payout_details_admin_all ON rider_payout_details
  FOR ALL USING (is_admin());

DROP TRIGGER IF EXISTS set_rider_payout_details_updated_at ON rider_payout_details;
CREATE TRIGGER set_rider_payout_details_updated_at
  BEFORE UPDATE ON rider_payout_details
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- Guarded save. Validates in-DB (there's no review step to catch bad data
-- later): PAN format, and a complete payout target for the chosen method.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_rider_payout_details(
  p_legal_name          TEXT,
  p_pan_number          TEXT,
  p_payout_method       TEXT,
  p_bank_account_name   TEXT,
  p_bank_account_number TEXT,
  p_bank_ifsc           TEXT,
  p_upi_id              TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rider UUID;
  v_pan   TEXT := upper(btrim(coalesce(p_pan_number, '')));
  v_ifsc  TEXT := upper(btrim(coalesce(p_bank_ifsc, '')));
  v_upi   TEXT := lower(btrim(coalesce(p_upi_id, '')));
  v_acct  TEXT := regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g');
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid();
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a rider'; END IF;

  IF length(btrim(coalesce(p_legal_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter your full name as on the bank account / PAN card';
  END IF;
  IF v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    RAISE EXCEPTION 'PAN must look like ABCDE1234F';
  END IF;

  IF p_payout_method = 'upi' THEN
    IF v_upi !~ '^[a-z0-9.\-_]{2,}@[a-z][a-z0-9]{1,}$' THEN
      RAISE EXCEPTION 'Enter a valid UPI ID like name@bank';
    END IF;
  ELSIF p_payout_method = 'bank' THEN
    IF length(btrim(coalesce(p_bank_account_name, ''))) < 3 THEN
      RAISE EXCEPTION 'Enter the account holder name';
    END IF;
    IF v_acct !~ '^[0-9]{9,18}$' THEN
      RAISE EXCEPTION 'Account number must be 9–18 digits';
    END IF;
    IF v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' THEN
      RAISE EXCEPTION 'IFSC must look like HDFC0001234';
    END IF;
  ELSE
    RAISE EXCEPTION 'Choose UPI or bank transfer';
  END IF;

  INSERT INTO rider_payout_details (
    rider_id, legal_name, pan_number, payout_method,
    bank_account_name, bank_account_number, bank_ifsc, upi_id
  ) VALUES (
    v_rider, btrim(p_legal_name), v_pan, p_payout_method,
    NULLIF(btrim(coalesce(p_bank_account_name, '')), ''),
    NULLIF(v_acct, ''), NULLIF(v_ifsc, ''), NULLIF(v_upi, '')
  )
  ON CONFLICT (rider_id) DO UPDATE SET
    legal_name          = EXCLUDED.legal_name,
    pan_number          = EXCLUDED.pan_number,
    payout_method       = EXCLUDED.payout_method,
    bank_account_name   = EXCLUDED.bank_account_name,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc           = EXCLUDED.bank_ifsc,
    upi_id              = EXCLUDED.upi_id;
END; $$;

REVOKE ALL ON FUNCTION save_rider_payout_details(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_rider_payout_details(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ==================== 035_complete_after_finalize.sql ====================
-- Migration 035: let the rider close out a delivery after the customer's last
-- decision auto-completed the order. Run after 034. Idempotent.
--
-- FOUND IN THE 2026-07-07 LIVE LOOP TEST (order FTZ-2026-00049):
-- finalize_order_if_decided (019) runs on the customer's LAST keep/return and
-- completes the ORDER + try session — but never the DELIVERY. Before 033 that
-- was masked: rider_complete_delivery had no status guard, so the rider's
-- "complete" tap still worked afterwards. 033's integrity guard (order must be
-- try_window_active) closed that hole and exposed the gap: once the customer
-- decides everything, the delivery is stuck at 'arrived' forever — the rider is
-- never credited (total_deliveries / earnings) and the 1-job cap stays blocked.
--
-- Fix: rider_complete_delivery now ALSO accepts order status 'completed' (the
-- finalize-ran case). In that state every item is already decided, so there is
-- nothing to auto-return — the rider is just confirming physical collection of
-- the returns before leaving. The try_window_active path keeps all 033 guards.
-- ============================================================

CREATE OR REPLACE FUNCTION rider_complete_delivery(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_ostatus order_status; v_deadline timestamptz;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id, o.status INTO v_order, v_ostatus
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'arrived'
  FOR UPDATE OF d;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot complete delivery'; END IF;

  IF v_ostatus = 'try_window_active' THEN
    -- Window still open: only completable when it's genuinely over.
    SELECT deadline_at INTO v_deadline
    FROM try_sessions WHERE order_id = v_order;

    IF EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.order_id = v_order AND oi.decision = 'pending'
    ) AND (v_deadline IS NULL OR v_deadline > now()) THEN
      RAISE EXCEPTION 'the customer is still deciding — wait for the timer or the last decision';
    END IF;

    PERFORM auto_return_pending_items(v_order);
    UPDATE orders SET status = 'completed' WHERE id = v_order;
    UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  ELSIF v_ostatus = 'completed' THEN
    -- finalize_order_if_decided (019) already closed the order on the
    -- customer's last decision — nothing pending, nothing to auto-return.
    NULL;
  ELSE
    RAISE EXCEPTION 'the try-on window has not started yet';
  END IF;

  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;


-- ==================== 036_offer_expiry_reliability.sql ====================
-- Migration 036: reliability — stale offers stop ringing riders, and genuinely
-- abandoned orders get cleaned up instead of hanging forever.
-- Run after 035. Idempotent.
--
-- FOUND IN THE 2026-07-07 LIVE LOOP TEST: confirmed-but-never-claimed orders
-- (days/weeks old test data) kept appearing in the offer feed — the agent saw
-- "waiting 25512 min" cards for orders no rider would ever take, and those
-- orders sat in 'confirmed' forever with no resolution.
--
-- This adds:
--   1. system_settings.offer_expiry_minutes — how long a confirmed order stays
--      offerable before it's considered abandoned (default 120 min). Config, not
--      hardcoded (same pattern as try_window_minutes / commission_rate).
--   2. available_deliveries() — only offers orders placed within that window, so
--      stale jobs stop ringing riders immediately.
--   3. expire_stale_offers() — a sweep (for pg_cron) that terminally resolves an
--      abandoned order: cancels it, fails its unclaimed delivery, and notifies
--      the customer (born-visible notification). Prevents orphaned 'confirmed'
--      orders. Service-role only.
--   4. Optional pg_cron schedule for BOTH sweeps (this one + 027's try-window).
-- ============================================================

-- 1. Config knob -------------------------------------------------------------
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS offer_expiry_minutes INTEGER NOT NULL DEFAULT 120
  CHECK (offer_expiry_minutes >= 5);

-- 2. Offer feed v4: add the freshness filter, preserve everything from 033
--    (verified-rider gate, 1-job cap, decline cooldown, shape, ordering).
CREATE OR REPLACE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_area    JSONB,
  item_count   BIGINT,
  delivery_fee NUMERIC,
  store_name   TEXT,
  store_area   TEXT,
  store_count  BIGINT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rider   UUID;
  v_max_age INT;
BEGIN
  SELECT id INTO v_rider FROM riders r
  WHERE r.user_id = auth.uid() AND r.is_verified = true;
  IF v_rider IS NULL THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  -- One job at a time: an active delivery hides the feed entirely.
  IF EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.rider_id = v_rider
      AND d.status IN ('accepted', 'picked_up', 'en_route', 'arrived')
  ) THEN
    RETURN;
  END IF;

  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         jsonb_build_object(
           'city',     d.drop_address->>'city',
           'pincode',  d.drop_address->>'pincode',
           'landmark', d.drop_address->>'landmark'
         ),
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.delivery_fee,
         d.pickup_address->>'store_name',
         concat_ws(' · ', NULLIF(d.pickup_address->>'city', ''),
                          NULLIF(d.pickup_address->>'pincode', '')),
         COALESCE((d.pickup_address->>'store_count')::BIGINT, 1),
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND o.created_at > now() - (v_max_age || ' minutes')::interval   -- freshness
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.rider_id = v_rider
        AND dd.delivery_id = d.id
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END; $$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;

-- 3. Sweep: terminally resolve abandoned orders (confirmed + never claimed +
--    past the expiry window). Cancels the order, fails the unclaimed delivery,
--    and drops a born-visible notification to the customer. NOT client-granted.
CREATE OR REPLACE FUNCTION expire_stale_offers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_age INT;
  r         RECORD;
  n         INT := 0;
BEGIN
  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  FOR r IN
    SELECT d.id AS delivery_id, o.id AS order_id, o.user_id, o.order_number
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    WHERE d.rider_id IS NULL
      AND d.status = 'assigned'
      AND o.status = 'confirmed'
      AND o.created_at <= now() - (v_max_age || ' minutes')::interval
  LOOP
    UPDATE orders     SET status = 'cancelled' WHERE id = r.order_id;
    UPDATE deliveries SET status = 'failed', completed_at = now() WHERE id = r.delivery_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.user_id, 'order_update',
      'Order could not be delivered',
      'We couldn''t find a rider for order ' || COALESCE(r.order_number, '') ||
        ' in time, so it has been cancelled. You have not been charged — please try again.',
      jsonb_build_object('kind', 'order_cancelled_no_rider', 'order_id', r.order_id)
    );
    n := n + 1;
  END LOOP;

  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION expire_stale_offers() FROM PUBLIC;

-- 4. OPTIONAL — schedule both sweeps every minute. Needs the pg_cron extension
--    (Supabase dashboard → Database → Extensions → enable "pg_cron"). Uncomment:
--   SELECT cron.schedule('expire-stale-offers', '* * * * *', $$SELECT expire_stale_offers()$$);
--   SELECT cron.schedule('expire-try-windows',  '* * * * *', $$SELECT expire_try_windows()$$);
--
-- Without pg_cron the offer FEED still self-heals (stale orders simply stop
-- being offered via the freshness filter in step 2); the sweep is what also
-- cancels the order + notifies the customer, so run it on a schedule for prod.


-- ==================== 037_rider_fee.sql ====================
-- Migration 037: decouple rider pay from the customer's delivery charge.
-- Run after 036. Idempotent.
--
-- THE PROBLEM (found 2026-07-09): orders.delivery_fee did double duty — it was
-- both what the customer is charged for delivery AND what the rider earns. So a
-- customer who got free delivery (any order at/above free_delivery_above, i.e.
-- most fashion orders) left the rider earning ₹0 for the same trip + 7-min wait.
-- The rider's pay is a platform cost and must not depend on the customer waiver.
--
-- FIX: a separate, always-paid rider fee.
--   • system_settings.rider_fee  — flat amount Fitzo pays a rider per completed
--     delivery (config, default 40; independent of the customer delivery charge).
--   • orders.rider_fee           — stamped at checkout from that config (always,
--     no free-delivery waiver). Agent earnings + Admin > Agent Payouts read THIS,
--     not delivery_fee. orders.delivery_fee stays the CUSTOMER charge (free-above
--     logic unchanged, for when the customer charge is actually collected).
-- ============================================================

-- 1. Config: what the rider earns per completed delivery.
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS rider_fee NUMERIC(10,2) NOT NULL DEFAULT 40
  CHECK (rider_fee >= 0);

-- 2. Per-order rider pay, stamped at placement.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 3. Backfill: give every existing order the currently-configured rider fee, so
--    historical rider earnings aren't zero. Only touches unset (0) rows, so it's
--    safe to re-run.
UPDATE orders
   SET rider_fee = COALESCE((SELECT rider_fee FROM system_settings WHERE id = 1), 40)
 WHERE rider_fee = 0;


-- ==================== 038_offer_shows_rider_fee.sql ====================
-- Migration 038: the rider offer card shows the RIDER's pay, not the customer's
-- delivery charge. Run after 037. Idempotent.
--
-- After 037 decoupled rider pay (orders.rider_fee) from the customer delivery
-- charge (orders.delivery_fee), available_deliveries() was still returning
-- delivery_fee — so a rider saw "+₹0" on any free-delivery order even though they
-- now earn the flat rider_fee. This repoints the offer feed to rider_fee.
--
-- The RETURNS TABLE column changes name (delivery_fee → rider_fee), which needs a
-- DROP (CREATE OR REPLACE can't alter the return type). Everything else is
-- carried over verbatim from 036: verified-rider gate, 1-job cap, offer-expiry
-- freshness filter, decline cooldown, ordering.
-- ============================================================

DROP FUNCTION IF EXISTS available_deliveries();

CREATE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_area    JSONB,
  item_count   BIGINT,
  rider_fee    NUMERIC,   -- what the RIDER earns (was delivery_fee)
  store_name   TEXT,
  store_area   TEXT,
  store_count  BIGINT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rider   UUID;
  v_max_age INT;
BEGIN
  SELECT id INTO v_rider FROM riders r
  WHERE r.user_id = auth.uid() AND r.is_verified = true;
  IF v_rider IS NULL THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  -- One job at a time: an active delivery hides the feed entirely.
  IF EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.rider_id = v_rider
      AND d.status IN ('accepted', 'picked_up', 'en_route', 'arrived')
  ) THEN
    RETURN;
  END IF;

  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         jsonb_build_object(
           'city',     d.drop_address->>'city',
           'pincode',  d.drop_address->>'pincode',
           'landmark', d.drop_address->>'landmark'
         ),
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.rider_fee,                 -- the rider's pay, not the customer charge
         d.pickup_address->>'store_name',
         concat_ws(' · ', NULLIF(d.pickup_address->>'city', ''),
                          NULLIF(d.pickup_address->>'pincode', '')),
         COALESCE((d.pickup_address->>'store_count')::BIGINT, 1),
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND o.created_at > now() - (v_max_age || ' minutes')::interval   -- freshness
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.rider_id = v_rider
        AND dd.delivery_id = d.id
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END; $$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;


-- ==================== 039_payment_captured_webhook.sql ====================
-- Migration 039: Razorpay `payment.captured` webhook settlement
-- Run in Supabase SQL Editor after migration 038. Idempotent.
--
-- WHY: a Keep payment is settled only by the customer's browser success handler
-- (order-tracking → confirm_keep_payment). If the tab closes / the phone dies
-- right after Razorpay captures the money, the payment stays 'initiated' and the
-- order unpaid — Fitzo has the money but doesn't know it. Razorpay's
-- `payment.captured` webhook is the server-to-server source of truth; this
-- migration gives it a settlement path.
--
-- TRUST MODEL (same as migration 009): the customer app holds only the ANON key,
-- so the webhook RPC cannot trust its caller — anyone with the anon key could
-- call it. It therefore re-verifies the webhook HMAC signature *inside Postgres*
-- over the raw request body, keyed by the WEBHOOK secret (a different secret
-- from the checkout key secret) stored in Supabase Vault. A forged call without
-- the webhook secret is rejected.
--
-- DOUBLE-SETTLE RACE: the client success handler and the webhook both fire for
-- the same capture. Both paths funnel into settle_keep_payment(), which locks
-- the payments row FOR UPDATE and no-ops when it is already 'success' — whoever
-- arrives second waits on the lock, then does nothing.
--
-- ONE-TIME MANUAL STEPS (Dilip — owns Razorpay + money flow):
--   1. Razorpay Dashboard → Settings → Webhooks → Add New Webhook:
--        URL:            https://<customer-domain>/api/razorpay/webhook
--                        (local testing: expose :3000 via a tunnel, e.g. ngrok)
--        Secret:         generate a strong random string (this is the WEBHOOK
--                        secret — not the key secret)
--        Active events:  payment.captured
--   2. Store the same secret in Vault:
--        SELECT vault.create_secret('<webhook_secret>', 'razorpay_webhook_secret', 'Razorpay webhook secret');
--        -- verify: SELECT name FROM vault.secrets WHERE name = 'razorpay_webhook_secret';
--   3. Add it to apps/customer/.env.local:
--        RAZORPAY_WEBHOOK_SECRET=<webhook_secret>
--      (the route handler fast-rejects bad signatures before touching the DB;
--       the RPC re-verifies in-DB so the route check is belt-and-braces only).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- settle_keep_payment: the settle core, extracted verbatim from 009's
-- confirm_keep_payment so the client-confirm path and the webhook path share
-- one implementation and cannot drift.
--
-- NOT callable by any client role (no grants) — only the SECURITY DEFINER
-- entry points below reach it. It does NO signature or ownership checks
-- itself; each entry point does its own before calling.
--
-- Returns the Fitzo order id it settled, or NULL when the payment was already
-- 'success' (idempotent duplicate).
-- ============================================================
CREATE OR REPLACE FUNCTION settle_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT  -- checkout signature from the client path; NULL from the webhook
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
BEGIN
  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Idempotent: a duplicate settle (client handler + webhook) is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN NULL;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = COALESCE(p_razorpay_signature, razorpay_signature),
         paid_at             = NOW()
   WHERE id = v_payment.id;

  -- Flip the specific kept item now that it's paid for.
  IF v_payment.order_item_id IS NOT NULL THEN
    UPDATE order_items
       SET decision = 'keep', decision_at = NOW()
     WHERE id = v_payment.order_item_id;
  END IF;

  -- Mark the order paid once no kept item is left unpaid.
  UPDATE orders o
     SET payment_status = 'paid'
   WHERE o.id = v_payment.order_id
     AND NOT EXISTS (
       SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.decision = 'keep'
          AND NOT EXISTS (
            SELECT 1 FROM payments p
             WHERE p.order_item_id = oi.id AND p.status = 'success'
          )
     );

  RETURN v_payment.order_id;
END;
$$;

REVOKE ALL ON FUNCTION settle_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
-- deliberately no GRANTs: internal only

-- ============================================================
-- confirm_keep_payment: SAME contract as 009 (args, behavior, error messages)
-- — now a thin wrapper: verify the checkout HMAC in-DB + check ownership, then
-- delegate the settle to settle_keep_payment().
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- include `extensions` so pgcrypto's hmac() resolves (Supabase installs it there, not public)
SET search_path = public, extensions
AS $$
DECLARE
  v_secret   TEXT;
  v_expected TEXT;
BEGIN
  -- Read the Razorpay KEY secret from Vault (decrypted on read; only the definer can see it).
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'razorpay_key_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'razorpay secret not configured (create vault secret razorpay_key_secret)';
  END IF;

  -- Razorpay signs: HMAC_SHA256(razorpay_order_id || '|' || razorpay_payment_id), hex digest.
  v_expected := encode(
    hmac(p_razorpay_order_id || '|' || p_razorpay_payment_id, v_secret, 'sha256'),
    'hex'
  );

  IF v_expected IS DISTINCT FROM p_razorpay_signature THEN
    RAISE EXCEPTION 'invalid payment signature';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM payments WHERE razorpay_order_id = p_razorpay_order_id
  ) THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Ownership: caller must own the order this payment belongs to.
  -- (SECURITY DEFINER bypasses RLS, so we check ownership explicitly.)
  IF NOT EXISTS (
    SELECT 1 FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.razorpay_order_id = p_razorpay_order_id AND o.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  PERFORM settle_keep_payment(p_razorpay_order_id, p_razorpay_payment_id, p_razorpay_signature);
END;
$$;

-- Only logged-in customers (and admins) may call it; the function checks ownership itself.
REVOKE ALL ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- razorpay_webhook_captured: entry point for the customer app's
-- /api/razorpay/webhook route handler. Verifies the WEBHOOK signature over the
-- raw body in-DB, then settles exactly like the client path.
--
-- Returns a status string for the route's response / logs:
--   'settled'         — payment settled by this call
--   'already_settled' — client handler (or an earlier delivery) got there first
--   'not_tracked'     — capture for a razorpay order we have no payments row for
--                       (e.g. a dashboard test payment) — not an error, don't retry
--   'ignored'         — event other than payment.captured
-- ============================================================
CREATE OR REPLACE FUNCTION razorpay_webhook_captured(
  p_payload   TEXT,  -- the RAW webhook request body, byte-for-byte
  p_signature TEXT   -- the X-Razorpay-Signature header
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret         TEXT;
  v_expected       TEXT;
  v_event          JSONB;
  v_entity         JSONB;
  v_rzp_order_id   TEXT;
  v_rzp_payment_id TEXT;
  v_amount_paise   BIGINT;
  v_payment        payments%ROWTYPE;
  v_order_id       UUID;
BEGIN
  -- Read the WEBHOOK secret from Vault (distinct from the checkout key secret).
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'razorpay_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'razorpay webhook secret not configured (create vault secret razorpay_webhook_secret)';
  END IF;

  -- Razorpay signs webhooks: HMAC_SHA256(raw_body), hex digest.
  v_expected := encode(hmac(p_payload, v_secret, 'sha256'), 'hex');
  IF v_expected IS DISTINCT FROM p_signature THEN
    RAISE EXCEPTION 'invalid webhook signature';
  END IF;

  v_event := p_payload::jsonb;
  IF v_event->>'event' IS DISTINCT FROM 'payment.captured' THEN
    RETURN 'ignored';
  END IF;

  v_entity         := v_event->'payload'->'payment'->'entity';
  v_rzp_order_id   := v_entity->>'order_id';
  v_rzp_payment_id := v_entity->>'id';
  v_amount_paise   := (v_entity->>'amount')::BIGINT;

  IF v_rzp_order_id IS NULL OR v_rzp_payment_id IS NULL THEN
    RAISE EXCEPTION 'malformed payment.captured payload';
  END IF;

  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = v_rzp_order_id;

  IF NOT FOUND THEN
    RETURN 'not_tracked';
  END IF;

  -- Integrity: the captured amount must equal what checkout initiated
  -- (payments.amount is rupees; the webhook entity amount is paise).
  IF v_amount_paise IS DISTINCT FROM ROUND(v_payment.amount * 100)::BIGINT THEN
    RAISE EXCEPTION 'captured amount % paise does not match initiated payment for razorpay order %',
      v_amount_paise, v_rzp_order_id;
  END IF;

  v_order_id := settle_keep_payment(v_rzp_order_id, v_rzp_payment_id, NULL);
  IF v_order_id IS NULL THEN
    RETURN 'already_settled';
  END IF;

  -- Close the loop like the client path does. The client calls
  -- finalize_order_if_decided (019) after settling, but that RPC is
  -- owner-gated on auth.uid(), which a webhook call doesn't have — so the
  -- same idempotent steps are inlined here (keep in sync with 019).
  IF NOT EXISTS (
    SELECT 1 FROM order_items oi
     WHERE oi.order_id = v_order_id AND oi.decision = 'pending'
  ) THEN
    UPDATE try_sessions
       SET status = 'completed'
     WHERE order_id = v_order_id AND status = 'active';

    UPDATE orders
       SET status = 'completed', updated_at = NOW()
     WHERE id = v_order_id
       AND status IN ('try_window_active', 'return_requested', 'return_picked');
  END IF;

  RETURN 'settled';
END;
$$;

-- The route handler calls this with the ANON key (webhooks have no user
-- session). Safe: authorization is the in-DB webhook-signature check above,
-- which requires the secret only Razorpay and the Vault hold.
REVOKE ALL ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) TO anon, authenticated;


-- ==================== 040_delivery_fee_on_first_keep.sql ====================
-- Migration 040: collect the customer delivery fee with the FIRST Keep payment
-- Run in Supabase SQL Editor after migration 039. Idempotent.
--
-- WHY: `orders.delivery_fee` (the customer charge, decoupled from rider pay in
-- 037) was stamped at checkout but never actually collected — the per-item Keep
-- charge was the bare item price, and COD (which collected it in cash) is gone.
-- Owner decision (2026-07-10): fold the fee into the FIRST Keep charge on the
-- order — no extra payment prompt, rides the existing verified per-item flow.
-- If the customer returns everything, the fee goes uncollected (accepted churn
-- cost, also an owner decision).
--
-- HOW: no RPC changes. createKeepPayment (customer server action) now:
--   1. checks whether any successful payment on the order already carried the
--      fee (delivery_fee_component > 0),
--   2. if not, charges item price + orders.delivery_fee and records the split
--      in the new column below.
-- The 039 webhook amount check keeps working because payments.amount is the
-- full charged amount (item + fee component).
--
-- KNOWN LIMIT (accepted): the "already collected?" check happens in the server
-- action, so two Keeps initiated simultaneously from two tabs could both carry
-- the fee. The UI serializes keeps on one device, and the refund path (Track A
-- Task 4) covers the freak case.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS delivery_fee_component NUMERIC(10,2) NOT NULL DEFAULT 0
  CHECK (delivery_fee_component >= 0);

COMMENT ON COLUMN payments.delivery_fee_component IS
  'Portion of amount that is the customer delivery fee (folded into the first Keep charge, migration 040). 0 = pure item payment.';


-- ==================== 041_payment_refunds.sql ====================
-- Migration 041: admin-initiated payment refunds (Track A Task 4, scoped MVP)
-- Run in Supabase SQL Editor after migration 040. Idempotent.
--
-- WHY: no refund path existed anywhere — a charging mistake (double fee, wrong
-- item) could only be fixed with raw SQL + the Razorpay dashboard. Admin >
-- Payments (read-only by design) grows exactly ONE action: full-refund a
-- successful Razorpay payment row.
--
-- HOW: the money moves via Razorpay's refund API, called from a guarded admin
-- server action (requireAdmin() + service-role write, the established admin
-- mutation pattern — no new RPC/RLS needed; customers can already SELECT their
-- own payment rows, so they see the refunded status for free). The action
-- flips the SAME payments row success → 'refunded' (the enum has had the value
-- since 002; the Payments screen has always had a Refunded tab) and records the
-- Razorpay refund id + when + why below. Everything is audit-logged.
--
-- SCOPE (MVP, deliberate): full refunds only, admin-initiated only, no
-- customer-facing self-serve, and no automatic order/item state changes — the
-- admin fixes order state separately via the existing order-detail actions if
-- needed (e.g. cancel with reason).

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS refunded_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason      TEXT;

COMMENT ON COLUMN payments.razorpay_refund_id IS
  'Razorpay refund id (rfnd_…) when this payment was refunded via Admin > Payments (migration 041).';
COMMENT ON COLUMN payments.refunded_at IS
  'When the admin-initiated full refund was issued (migration 041).';
COMMENT ON COLUMN payments.refund_reason IS
  'Admin-entered reason for the refund — also in the audit log (migration 041).';


-- ==================== 042_payout_reference.sql ====================
-- Migration 042: traceable manual payouts (Track A Task 5 — ledger hardening)
-- Run in Supabase SQL Editor after migration 041. Idempotent.
--
-- WHY: real Razorpay disbursement is blocked on business steps, not code —
-- RazorpayX needs a registered entity + its own account/KYC, and Route is
-- RBI-gated behind ₹40L turnover (full investigation + go-live checklist in
-- docs/PAYOUTS-GOING-LIVE.md). Until then money moves by MANUAL bank/UPI
-- transfer, and the ledgers are the only record — so make each entry
-- traceable:
--
--   reference — the UTR / UPI transaction id of the manual transfer (typed by
--               the admin in the record-payout modal; optional but nagged).
--   paid_to   — masked destination snapshot at record time ("UPI x@y" /
--               "A/c ····1234 · HDFC0001234"). Riders/stores can edit their
--               payout details later; the snapshot keeps the ledger honest
--               about where the money actually went.
--
-- Both admin record-payout actions degrade gracefully pre-042 (retry the
-- insert without the new columns).

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_to   TEXT;

ALTER TABLE agent_payouts
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_to   TEXT;

COMMENT ON COLUMN payouts.reference        IS 'UTR / UPI txn id of the manual transfer (migration 042).';
COMMENT ON COLUMN payouts.paid_to          IS 'Masked destination snapshot at record time (migration 042).';
COMMENT ON COLUMN agent_payouts.reference  IS 'UTR / UPI txn id of the manual transfer (migration 042).';
COMMENT ON COLUMN agent_payouts.paid_to    IS 'Masked destination snapshot at record time (migration 042).';


-- ==================== 043_gateway_fee_capture.sql ====================
-- Migration 043: capture Razorpay gateway fees on payments (money plan M1)
-- Run in Supabase SQL Editor after migration 042. Idempotent.
--
-- WHY: Razorpay takes ~2% MDR + 18% GST on every capture, but Fitzo never
-- records it — so every margin figure (admin Money card, future P&L) overstates
-- by the gateway's cut. Razorpay reports the exact fee per payment: the
-- `payment.captured` webhook payload and the Payments fetch API both carry
-- `fee` and `tax` on the payment entity (both in PAISE).
--
-- SEMANTICS (Razorpay's, documented here so nobody re-derives them wrong):
--   • entity.fee = the TOTAL amount Razorpay deducted, INCLUDING tax.
--   • entity.tax = the GST portion inside that fee.
--   • Net MDR   = fee − tax.
--   • On refunds Razorpay does NOT return the fee — it stays a sunk cost, so a
--     refunded payment keeps its gateway_fee (order_economics treats it as cost).
--   • NULL gateway_fee = "not yet known" (pre-043 rows, or webhook not yet
--     delivered). 0 is a real value (some promos/methods are zero-fee).
--
-- WRITE PATHS:
--   1. razorpay_webhook_captured() (below) stamps fee+tax from the webhook
--      payload — including when the payment was already settled by the client
--      path, because the client success handler never sees fee data. The stamp
--      only fills NULLs; it never overwrites a recorded value.
--   2. Admin > Payments "Sync gateway fees" (server action) backfills
--      pre-043 / missed rows via the Razorpay Payments fetch API.

-- ============================================================
-- 1. Columns (rupees, like payments.amount — converted from paise on write)
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_tax NUMERIC(10,2);

COMMENT ON COLUMN payments.gateway_fee IS
  'Total Razorpay deduction for this capture, in rupees, INCLUDING GST (entity.fee/100). NULL = not yet reported. Not reversed on refund.';
COMMENT ON COLUMN payments.gateway_tax IS
  'GST portion inside gateway_fee, in rupees (entity.tax/100). Net MDR = gateway_fee - gateway_tax.';

-- ============================================================
-- 2. razorpay_webhook_captured: 039's function re-created verbatim, plus the
--    fee/tax stamp. Contract unchanged (args, return values, error messages).
-- ============================================================
CREATE OR REPLACE FUNCTION razorpay_webhook_captured(
  p_payload   TEXT,  -- the RAW webhook request body, byte-for-byte
  p_signature TEXT   -- the X-Razorpay-Signature header
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret         TEXT;
  v_expected       TEXT;
  v_event          JSONB;
  v_entity         JSONB;
  v_rzp_order_id   TEXT;
  v_rzp_payment_id TEXT;
  v_amount_paise   BIGINT;
  v_fee_paise      BIGINT;
  v_tax_paise      BIGINT;
  v_payment        payments%ROWTYPE;
  v_order_id       UUID;
BEGIN
  -- Read the WEBHOOK secret from Vault (distinct from the checkout key secret).
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'razorpay_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'razorpay webhook secret not configured (create vault secret razorpay_webhook_secret)';
  END IF;

  -- Razorpay signs webhooks: HMAC_SHA256(raw_body), hex digest.
  v_expected := encode(hmac(p_payload, v_secret, 'sha256'), 'hex');
  IF v_expected IS DISTINCT FROM p_signature THEN
    RAISE EXCEPTION 'invalid webhook signature';
  END IF;

  v_event := p_payload::jsonb;
  IF v_event->>'event' IS DISTINCT FROM 'payment.captured' THEN
    RETURN 'ignored';
  END IF;

  v_entity         := v_event->'payload'->'payment'->'entity';
  v_rzp_order_id   := v_entity->>'order_id';
  v_rzp_payment_id := v_entity->>'id';
  v_amount_paise   := (v_entity->>'amount')::BIGINT;
  v_fee_paise      := (v_entity->>'fee')::BIGINT;   -- total deduction incl. GST
  v_tax_paise      := (v_entity->>'tax')::BIGINT;   -- GST portion of the fee

  IF v_rzp_order_id IS NULL OR v_rzp_payment_id IS NULL THEN
    RAISE EXCEPTION 'malformed payment.captured payload';
  END IF;

  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = v_rzp_order_id;

  IF NOT FOUND THEN
    RETURN 'not_tracked';
  END IF;

  -- Integrity: the captured amount must equal what checkout initiated
  -- (payments.amount is rupees; the webhook entity amount is paise).
  IF v_amount_paise IS DISTINCT FROM ROUND(v_payment.amount * 100)::BIGINT THEN
    RAISE EXCEPTION 'captured amount % paise does not match initiated payment for razorpay order %',
      v_amount_paise, v_rzp_order_id;
  END IF;

  -- Stamp the gateway fee BEFORE the settle branch: the client path usually
  -- settles first (webhook returns 'already_settled'), and the client never
  -- sees fee data — this webhook is the only automatic source. Fill-only:
  -- never overwrite a value already recorded (e.g. by the admin backfill).
  IF v_fee_paise IS NOT NULL THEN
    UPDATE payments
       SET gateway_fee = ROUND(v_fee_paise / 100.0, 2),
           gateway_tax = CASE WHEN v_tax_paise IS NULL THEN gateway_tax
                              ELSE ROUND(v_tax_paise / 100.0, 2) END
     WHERE id = v_payment.id
       AND gateway_fee IS NULL;
  END IF;

  v_order_id := settle_keep_payment(v_rzp_order_id, v_rzp_payment_id, NULL);
  IF v_order_id IS NULL THEN
    RETURN 'already_settled';
  END IF;

  -- Close the loop like the client path does. The client calls
  -- finalize_order_if_decided (019) after settling, but that RPC is
  -- owner-gated on auth.uid(), which a webhook call doesn't have — so the
  -- same idempotent steps are inlined here (keep in sync with 019).
  IF NOT EXISTS (
    SELECT 1 FROM order_items oi
     WHERE oi.order_id = v_order_id AND oi.decision = 'pending'
  ) THEN
    UPDATE try_sessions
       SET status = 'completed'
     WHERE order_id = v_order_id AND status = 'active';

    UPDATE orders
       SET status = 'completed', updated_at = NOW()
     WHERE id = v_order_id
       AND status IN ('try_window_active', 'return_requested', 'return_picked');
  END IF;

  RETURN 'settled';
END;
$$;

-- Grants identical to 039: the route calls with the anon key; the in-DB
-- webhook-signature check is the authorization.
REVOKE ALL ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) TO anon, authenticated;


-- ==================== 044_order_economics.sql ====================
-- Migration 044: order_economics — ONE source of truth for per-order money (money plan M2)
-- Run in Supabase SQL Editor after migration 043. Idempotent.
--
-- WHY: the money math lives in three hand-mirrored copies (admin Money card,
-- payouts/compute.ts, store lib/earnings.ts) with "must match" comments, none
-- of them refund-aware and none seeing gateway fees. This view computes it
-- once, in the DB, so every screen reads identical rupees. Consumers are
-- repointed in two steps: Money card now (this task), payout computes /
-- store Earnings / dashboard / analytics next (W2.7) — then the copies die.
--
-- REFUND SEMANTICS (owner decision, 2026-07-14 — "accounting-only"):
-- a refund flips the payments row (041) but the item stays decision='keep'.
-- Revenue therefore keys on PAYMENTS, not decisions:
--   • an item counts as revenue ("kept_paid") only while it has a SUCCESS
--     payment — refunding drops it from kept_paid_gross, commission and
--     store_net automatically, with no item-state rewrite.
--   • gateway fees are NOT returned by Razorpay on refund → gateway_cost sums
--     fees over success AND refunded rows (sunk cost).
--   • the delivery fee travels with its payment: refunding the fee-carrying
--     payment removes it from delivery_fee_collected.
--
-- COMMISSION: still the live system_settings rate — M3 (045) will stamp the
-- rate/amount at settlement time and this view will switch to the stamped
-- values. store_net = kept_paid_gross − commission (additive complement, the
-- Money card's existing formula; ≤1 paisa from the old independent rounding).
--
-- RIDER COST: orders.rider_fee counts only once a delivery is COMPLETED —
-- margin never books a rider cost that was never earned.
--
-- SECURITY: security_invoker — the view runs with the CALLER's RLS. Admins
-- see everything (is_admin policies on the underlying tables); a customer
-- could at most see their own orders' rows; anon sees nothing. No RLS
-- widening, no SECURITY DEFINER.

CREATE OR REPLACE VIEW order_economics
WITH (security_invoker = on) AS
WITH cfg AS (
  -- Scalar subquery so cfg ALWAYS has one row — a missing settings singleton
  -- must not blank the whole view via the CROSS JOIN.
  SELECT COALESCE((SELECT commission_rate FROM system_settings WHERE id = 1), 15)::numeric AS rate
),
pay AS (
  SELECT
    p.order_id,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS captured_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0), 2)              AS refunded_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'success'), 0), 2)               AS net_captured,
    ROUND(COALESCE(SUM(p.delivery_fee_component) FILTER (WHERE p.status = 'success'), 0), 2) AS delivery_fee_collected,
    -- Sunk cost: Razorpay keeps its fee on refunds, so refunded rows still count.
    ROUND(COALESCE(SUM(p.gateway_fee) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS gateway_cost,
    BOOL_OR(p.status IN ('success','refunded') AND p.gateway_fee IS NULL)                   AS gateway_cost_incomplete
  FROM payments p
  GROUP BY p.order_id
),
items AS (
  SELECT
    oi.order_id,
    COUNT(*)                                              AS item_count,
    COUNT(*) FILTER (WHERE oi.decision = 'keep')          AS kept_count,
    COUNT(*) FILTER (WHERE oi.decision = 'return')        AS returned_count,
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kept_gross,
    -- Revenue-kept: keep decision AND a live success payment (see header).
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
      WHERE oi.decision = 'keep'
        AND EXISTS (SELECT 1 FROM payments p
                     WHERE p.order_item_id = oi.id AND p.status = 'success')
    ), 0), 2) AS kept_paid_gross
  FROM order_items oi
  GROUP BY oi.order_id
),
del AS (
  SELECT d.order_id, BOOL_OR(d.status = 'completed') AS delivery_completed
  FROM deliveries d
  GROUP BY d.order_id
),
sp AS (
  SELECT order_id, ROUND(COALESCE(SUM(amount), 0), 2) AS store_paid
  FROM payouts GROUP BY order_id
),
rp AS (
  SELECT order_id, ROUND(COALESCE(SUM(amount), 0), 2) AS rider_paid
  FROM agent_payouts GROUP BY order_id
)
SELECT
  o.id                                        AS order_id,
  o.order_number,
  o.user_id,
  o.created_at,
  o.status,
  o.payment_status,
  o.subtotal,
  o.delivery_fee                              AS delivery_fee_charged,
  COALESCE(o.rider_fee, 0)                    AS rider_fee,
  COALESCE(i.item_count, 0)                   AS item_count,
  COALESCE(i.kept_count, 0)                   AS kept_count,
  COALESCE(i.returned_count, 0)               AS returned_count,
  COALESCE(p.captured_total, 0)               AS captured_total,
  COALESCE(p.refunded_total, 0)               AS refunded_total,
  COALESCE(p.net_captured, 0)                 AS net_captured,
  COALESCE(p.delivery_fee_collected, 0)       AS delivery_fee_collected,
  COALESCE(p.gateway_cost, 0)                 AS gateway_cost,
  COALESCE(p.gateway_cost_incomplete, FALSE)  AS gateway_cost_incomplete,
  COALESCE(i.kept_gross, 0)                   AS kept_gross,
  COALESCE(i.kept_paid_gross, 0)              AS kept_paid_gross,
  -- kept but no live success payment (unpaid, or its payment was refunded)
  ROUND(COALESCE(i.kept_gross, 0) - COALESCE(i.kept_paid_gross, 0), 2) AS kept_unpaid_gross,
  cfg.rate                                    AS commission_rate,
  ROUND(COALESCE(i.kept_paid_gross, 0) * cfg.rate / 100.0, 2)          AS commission,
  ROUND(COALESCE(i.kept_paid_gross, 0)
        - ROUND(COALESCE(i.kept_paid_gross, 0) * cfg.rate / 100.0, 2), 2) AS store_net,
  COALESCE(d.delivery_completed, FALSE)       AS delivery_completed,
  CASE WHEN COALESCE(d.delivery_completed, FALSE)
       THEN COALESCE(o.rider_fee, 0) ELSE 0 END AS rider_cost,
  -- Contribution margin, pre-tax: what Fitzo actually made on this order.
  ROUND(
    ROUND(COALESCE(i.kept_paid_gross, 0) * cfg.rate / 100.0, 2)
    + COALESCE(p.delivery_fee_collected, 0)
    - CASE WHEN COALESCE(d.delivery_completed, FALSE)
           THEN COALESCE(o.rider_fee, 0) ELSE 0 END
    - COALESCE(p.gateway_cost, 0)
  , 2)                                        AS margin,
  COALESCE(s.store_paid, 0)                   AS store_paid,
  COALESCE(r.rider_paid, 0)                   AS rider_paid
FROM orders o
CROSS JOIN cfg
LEFT JOIN pay   p ON p.order_id = o.id
LEFT JOIN items i ON i.order_id = o.id
LEFT JOIN del   d ON d.order_id = o.id
LEFT JOIN sp    s ON s.order_id = o.id
LEFT JOIN rp    r ON r.order_id = o.id;

COMMENT ON VIEW order_economics IS
  'Per-order money truth (money plan M2). Refund-aware: revenue keys on live success payments, not item decisions. margin = commission + delivery_fee_collected - rider_cost - gateway_cost. Read by admin Money card (this migration) and, from W2.7, payout computes / store Earnings / dashboard / analytics.';

-- Callers bring their own RLS (security_invoker); anon gets nothing.
REVOKE ALL ON order_economics FROM PUBLIC;
GRANT SELECT ON order_economics TO authenticated;


-- ==================== 045_store_order_economics.sql ====================
-- Migration 045: store_order_economics() — per-STORE slice of the money truth (money plan M2, part 2)
-- Run in Supabase SQL Editor after migration 044. Idempotent.
-- ⚠️ Renumbering note: the launch plan reserved 045 for M3 (commission stamping)
--    and 046 for M4 (tax provisions); those shift to 046 and 047.
--
-- WHY: 044's order_economics view is per-ORDER, but store payables and store
-- Earnings need per-(store, order) numbers — an order can hold items from
-- several stores (until G1's single-store cart ships, and forever in history).
--
-- WHY A FUNCTION, NOT A VIEW: kept_paid_gross needs to read `payments`, and a
-- security_invoker view would apply the CALLER's RLS — store managers cannot
-- (and must not) SELECT customer payment rows, so for them the view would
-- silently report every kept item as unpaid. This SECURITY DEFINER function is
-- the house pattern instead (like 031's bulk mark-ready): it bypasses RLS
-- internally and gates explicitly —
--   p_store_id = NULL   → all stores; admin only (Admin > Store Payouts).
--   p_store_id given    → that store; its manager or an admin (store Earnings).
--
-- SEMANTICS: identical to 044 (one truth, two granularities — keep in sync):
--   kept_paid_gross = kept items with a live SUCCESS payment (refund-aware),
--   commission      = ROUND(kept_paid_gross × rate/100, 2)   [live settings
--                     rate until M3 stamps it at settlement],
--   store_net       = kept_paid_gross − commission (additive complement).
-- Only (store, order) groups with kept items are returned.

CREATE OR REPLACE FUNCTION store_order_economics(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
  store_id        UUID,
  order_id        UUID,
  kept_gross      NUMERIC,
  kept_paid_gross NUMERIC,
  commission_rate NUMERIC,
  commission      NUMERIC,
  store_net       NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  IF p_store_id IS NULL THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'not authorised';
    END IF;
  ELSIF NOT (is_admin() OR is_store_manager_of(p_store_id)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  v_rate := COALESCE((SELECT s.commission_rate FROM system_settings s WHERE s.id = 1), 15)::NUMERIC;

  RETURN QUERY
  SELECT
    g.sid,
    g.oid,
    g.kg,
    g.kpg,
    v_rate,
    ROUND(g.kpg * v_rate / 100.0, 2),
    ROUND(g.kpg - ROUND(g.kpg * v_rate / 100.0, 2), 2)
  FROM (
    SELECT
      pr.store_id AS sid,
      oi.order_id AS oid,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kg,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
        WHERE oi.decision = 'keep'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_item_id = oi.id AND p.status = 'success')
      ), 0), 2) AS kpg
    FROM order_items oi
    JOIN products pr ON pr.id = oi.product_id
    WHERE p_store_id IS NULL OR pr.store_id = p_store_id
    GROUP BY pr.store_id, oi.order_id
  ) g
  WHERE g.kg > 0;
END;
$$;

REVOKE ALL ON FUNCTION store_order_economics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_order_economics(UUID) TO authenticated;


-- ==================== 046_commission_stamping.sql ====================
-- Migration 046: commission stamped at settlement + per-store rate (money plan M3)
-- Run in Supabase SQL Editor after migration 045. Idempotent.
-- (Plan renumbering: this was "045/M3" in the launch PDF; 045 became the
--  store_order_economics RPC. Tax provisions M4 → 047.)
--
-- WHY: commission was computed at DISPLAY time from the live
-- system_settings.commission_rate — change the rate in Settings and every
-- historical unpaid payable silently recomputes while recorded payout rows
-- keep their old amounts: books that disagree with themselves. A real
-- marketplace freezes the rate per transaction. From now on the rate and the
-- rupee amount are stamped onto the order_item at the moment the Keep payment
-- SETTLES (client path and webhook share settle_keep_payment, so both stamp),
-- and the settings rate is only the default for NEW settlements.
--
-- Also adds the per-store override: stores.commission_rate (NULL = platform
-- default). Resolution order at settlement: store override → settings → 15.
--
-- READERS: order_economics (044) and store_order_economics (045) are
-- recreated to sum per-item COALESCE(stamped amount, computed-at-current-rate)
-- over kept-and-paid items. The fallback only matters for an item that
-- somehow settles unstamped — the backfill below stamps all existing history
-- at today's effective rates (same rupees as before, now frozen).

-- ============================================================
-- 1. Columns
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2)
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
COMMENT ON COLUMN stores.commission_rate IS
  'Per-store commission override in percent. NULL = platform default (system_settings.commission_rate). Applied to NEW settlements only — history keeps its stamped rate.';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);
COMMENT ON COLUMN order_items.commission_rate IS
  'Commission rate frozen at Keep-settlement time (migration 046). NULL = never settled (or pre-046 and unpaid).';
COMMENT ON COLUMN order_items.commission_amount IS
  'Commission rupees frozen at Keep-settlement time: ROUND(price_at_order × rate/100, 2). The economics views read this, not the live rate.';

-- ============================================================
-- 2. settle_keep_payment: 039's core re-created verbatim + the stamp.
--    Fill-only — a re-settle or race never overwrites a stamped value.
-- ============================================================
CREATE OR REPLACE FUNCTION settle_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT  -- checkout signature from the client path; NULL from the webhook
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_rate    NUMERIC;
BEGIN
  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Idempotent: a duplicate settle (client handler + webhook) is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN NULL;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = COALESCE(p_razorpay_signature, razorpay_signature),
         paid_at             = NOW()
   WHERE id = v_payment.id;

  -- Flip the specific kept item now that it's paid for — and freeze the
  -- commission at THIS moment (store override → settings default → 15).
  IF v_payment.order_item_id IS NOT NULL THEN
    SELECT COALESCE(s.commission_rate,
                    (SELECT ss.commission_rate FROM system_settings ss WHERE ss.id = 1),
                    15)::NUMERIC
      INTO v_rate
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN stores s ON s.id = p.store_id
     WHERE oi.id = v_payment.order_item_id;

    UPDATE order_items oi
       SET decision          = 'keep',
           decision_at       = NOW(),
           commission_rate   = COALESCE(oi.commission_rate, v_rate),
           commission_amount = COALESCE(oi.commission_amount,
                                        ROUND(oi.price_at_order * v_rate / 100.0, 2))
     WHERE oi.id = v_payment.order_item_id;
  END IF;

  -- Mark the order paid once no kept item is left unpaid.
  UPDATE orders o
     SET payment_status = 'paid'
   WHERE o.id = v_payment.order_id
     AND NOT EXISTS (
       SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.decision = 'keep'
          AND NOT EXISTS (
            SELECT 1 FROM payments p
             WHERE p.order_item_id = oi.id AND p.status = 'success'
          )
     );

  RETURN v_payment.order_id;
END;
$$;

REVOKE ALL ON FUNCTION settle_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
-- deliberately no GRANTs: internal only (called by confirm_keep_payment and
-- razorpay_webhook_captured, both SECURITY DEFINER)

-- ============================================================
-- 3. Backfill: freeze existing kept-and-paid history at today's effective
--    rates — identical rupees to what every screen showed yesterday, but no
--    longer mutable by a Settings change. Fill-only → idempotent.
-- ============================================================
UPDATE order_items oi
   SET commission_rate   = r.rate,
       commission_amount = ROUND(oi.price_at_order * r.rate / 100.0, 2)
  FROM (
    SELECT oi2.id,
           COALESCE(s.commission_rate,
                    (SELECT ss.commission_rate FROM system_settings ss WHERE ss.id = 1),
                    15)::NUMERIC AS rate
      FROM order_items oi2
      JOIN products p ON p.id = oi2.product_id
      LEFT JOIN stores s ON s.id = p.store_id
     WHERE oi2.decision = 'keep'
       AND oi2.commission_amount IS NULL
       AND EXISTS (SELECT 1 FROM payments pay
                    WHERE pay.order_item_id = oi2.id AND pay.status = 'success')
  ) r
 WHERE oi.id = r.id;

-- ============================================================
-- 4. order_economics (044) re-created: commission = Σ stamped amounts over
--    kept-and-paid items (store-aware live-rate fallback for unstamped edge
--    cases). Column list unchanged; commission_rate stays the platform
--    default rate — screens derive the effective rate as commission/kept_paid.
-- ============================================================
CREATE OR REPLACE VIEW order_economics
WITH (security_invoker = on) AS
WITH cfg AS (
  SELECT COALESCE((SELECT commission_rate FROM system_settings WHERE id = 1), 15)::NUMERIC AS rate
),
pay AS (
  SELECT
    p.order_id,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS captured_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0), 2)              AS refunded_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'success'), 0), 2)               AS net_captured,
    ROUND(COALESCE(SUM(p.delivery_fee_component) FILTER (WHERE p.status = 'success'), 0), 2) AS delivery_fee_collected,
    ROUND(COALESCE(SUM(p.gateway_fee) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS gateway_cost,
    BOOL_OR(p.status IN ('success','refunded') AND p.gateway_fee IS NULL)                   AS gateway_cost_incomplete
  FROM payments p
  GROUP BY p.order_id
),
items AS (
  SELECT
    oi.order_id,
    COUNT(*)                                              AS item_count,
    COUNT(*) FILTER (WHERE oi.decision = 'keep')          AS kept_count,
    COUNT(*) FILTER (WHERE oi.decision = 'return')        AS returned_count,
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kept_gross,
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
      WHERE oi.decision = 'keep'
        AND EXISTS (SELECT 1 FROM payments p
                     WHERE p.order_item_id = oi.id AND p.status = 'success')
    ), 0), 2) AS kept_paid_gross,
    -- Stamped at settlement (046); store-aware live-rate fallback for
    -- anything that settled unstamped.
    ROUND(COALESCE(SUM(
      COALESCE(oi.commission_amount,
               ROUND(oi.price_at_order * COALESCE(st.commission_rate, cfg.rate) / 100.0, 2))
    ) FILTER (
      WHERE oi.decision = 'keep'
        AND EXISTS (SELECT 1 FROM payments p
                     WHERE p.order_item_id = oi.id AND p.status = 'success')
    ), 0), 2) AS commission
  FROM order_items oi
  JOIN products pr ON pr.id = oi.product_id
  LEFT JOIN stores st ON st.id = pr.store_id
  CROSS JOIN cfg
  GROUP BY oi.order_id
),
del AS (
  SELECT d.order_id, BOOL_OR(d.status = 'completed') AS delivery_completed
  FROM deliveries d
  GROUP BY d.order_id
),
sp AS (
  SELECT order_id, ROUND(COALESCE(SUM(amount), 0), 2) AS store_paid
  FROM payouts GROUP BY order_id
),
rp AS (
  SELECT order_id, ROUND(COALESCE(SUM(amount), 0), 2) AS rider_paid
  FROM agent_payouts GROUP BY order_id
)
SELECT
  o.id                                        AS order_id,
  o.order_number,
  o.user_id,
  o.created_at,
  o.status,
  o.payment_status,
  o.subtotal,
  o.delivery_fee                              AS delivery_fee_charged,
  COALESCE(o.rider_fee, 0)                    AS rider_fee,
  COALESCE(i.item_count, 0)                   AS item_count,
  COALESCE(i.kept_count, 0)                   AS kept_count,
  COALESCE(i.returned_count, 0)               AS returned_count,
  COALESCE(p.captured_total, 0)               AS captured_total,
  COALESCE(p.refunded_total, 0)               AS refunded_total,
  COALESCE(p.net_captured, 0)                 AS net_captured,
  COALESCE(p.delivery_fee_collected, 0)       AS delivery_fee_collected,
  COALESCE(p.gateway_cost, 0)                 AS gateway_cost,
  COALESCE(p.gateway_cost_incomplete, FALSE)  AS gateway_cost_incomplete,
  COALESCE(i.kept_gross, 0)                   AS kept_gross,
  COALESCE(i.kept_paid_gross, 0)              AS kept_paid_gross,
  ROUND(COALESCE(i.kept_gross, 0) - COALESCE(i.kept_paid_gross, 0), 2) AS kept_unpaid_gross,
  cfg.rate                                    AS commission_rate,
  COALESCE(i.commission, 0)                   AS commission,
  ROUND(COALESCE(i.kept_paid_gross, 0) - COALESCE(i.commission, 0), 2) AS store_net,
  COALESCE(d.delivery_completed, FALSE)       AS delivery_completed,
  CASE WHEN COALESCE(d.delivery_completed, FALSE)
       THEN COALESCE(o.rider_fee, 0) ELSE 0 END AS rider_cost,
  ROUND(
    COALESCE(i.commission, 0)
    + COALESCE(p.delivery_fee_collected, 0)
    - CASE WHEN COALESCE(d.delivery_completed, FALSE)
           THEN COALESCE(o.rider_fee, 0) ELSE 0 END
    - COALESCE(p.gateway_cost, 0)
  , 2)                                        AS margin,
  COALESCE(s.store_paid, 0)                   AS store_paid,
  COALESCE(r.rider_paid, 0)                   AS rider_paid
FROM orders o
CROSS JOIN cfg
LEFT JOIN pay   p ON p.order_id = o.id
LEFT JOIN items i ON i.order_id = o.id
LEFT JOIN del   d ON d.order_id = o.id
LEFT JOIN sp    s ON s.order_id = o.id
LEFT JOIN rp    r ON r.order_id = o.id;

COMMENT ON VIEW order_economics IS
  'Per-order money truth (M2+M3). Refund-aware; commission = stamped-at-settlement amounts (046), commission_rate column = platform default rate — derive effective rate as commission/kept_paid_gross.';

REVOKE ALL ON order_economics FROM PUBLIC;
GRANT SELECT ON order_economics TO authenticated;

-- ============================================================
-- 5. store_order_economics (045) re-created on the same stamped basis.
--    commission_rate column now = the STORE's effective default rate
--    (override → settings), which is what both panels should display.
-- ============================================================
CREATE OR REPLACE FUNCTION store_order_economics(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
  store_id        UUID,
  order_id        UUID,
  kept_gross      NUMERIC,
  kept_paid_gross NUMERIC,
  commission_rate NUMERIC,
  commission      NUMERIC,
  store_net       NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default NUMERIC;
BEGIN
  IF p_store_id IS NULL THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'not authorised';
    END IF;
  ELSIF NOT (is_admin() OR is_store_manager_of(p_store_id)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  v_default := COALESCE((SELECT s.commission_rate FROM system_settings s WHERE s.id = 1), 15)::NUMERIC;

  RETURN QUERY
  SELECT
    g.sid,
    g.oid,
    g.kg,
    g.kpg,
    g.srate,
    g.comm,
    ROUND(g.kpg - g.comm, 2)
  FROM (
    SELECT
      pr.store_id AS sid,
      oi.order_id AS oid,
      COALESCE(st.commission_rate, v_default) AS srate,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kg,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
        WHERE oi.decision = 'keep'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_item_id = oi.id AND p.status = 'success')
      ), 0), 2) AS kpg,
      ROUND(COALESCE(SUM(
        COALESCE(oi.commission_amount,
                 ROUND(oi.price_at_order * COALESCE(st.commission_rate, v_default) / 100.0, 2))
      ) FILTER (
        WHERE oi.decision = 'keep'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_item_id = oi.id AND p.status = 'success')
      ), 0), 2) AS comm
    FROM order_items oi
    JOIN products pr ON pr.id = oi.product_id
    LEFT JOIN stores st ON st.id = pr.store_id
    WHERE p_store_id IS NULL OR pr.store_id = p_store_id
    GROUP BY pr.store_id, oi.order_id, st.commission_rate
  ) g
  WHERE g.kg > 0;
END;
$$;

REVOKE ALL ON FUNCTION store_order_economics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_order_economics(UUID) TO authenticated;


-- ==================== 047_stock_reservation.sql ====================
-- Migration 047: stock reservation — place_order RPC + transition-driven releases (launch plan G3/W2.8)
-- Run in Supabase SQL Editor after migration 046. Idempotent.
-- ⚠️ Renumbering: tax provisions (M4) move 047 → 048.
--
-- WHY (flaw G3): product_variants has carried stock_qty / reserved_qty /
-- available_qty (GENERATED stock − reserved) since day one, but nothing ever
-- wrote them at order time: placeOrder never checked stock, never reserved,
-- and its variant fallback happily picked an out-of-stock size. Two customers
-- could order the last unit; items out on a try-run stayed "available".
--
-- THE MODEL (textbook reservation, using the columns the schema already has):
--   place order      → reserved_qty += 1 per unit (locked, availability-checked)
--   customer KEEPS   → stock_qty −= 1, reserved_qty −= 1   (unit sold)
--   customer RETURNS → reserved_qty −= 1                   (back on the shelf)
--   order CANCELLED  → reserved_qty −= 1 for every still-reserved unit
--
-- Releases are DRIVEN BY TRIGGERS on the transitions, not by editing every
-- code path: settle_keep_payment, returnItem, auto_return_pending_items (027),
-- rider_fail_delivery (033), expire_stale_offers (036) and admin Cancel all
-- flip decisions / order status — the triggers below catch all of them without
-- touching those functions. Idempotency rides order_items.stock_reserved:
-- reservations are only ever consumed/released once per item, and pre-047
-- orders (flag false) are untouched by every branch.
--
-- ALSO IN THIS RPC (they must live in the same transaction to be correct):
--   • server-side pricing (flaw G2): unit price = products.discounted_price
--     ?? base_price read in-DB — the client's price is IGNORED. ⚠️ Jay: this
--     covers W1.4's server half; the client keeps sending its price only for
--     the pre-047 legacy fallback in checkout/actions.ts.
--   • single-store cart backstop (flaw G1, decided 2026-07-14): a cart
--     spanning >1 store errors MULTI_STORE_CART. ⚠️ Jay: W2.6's server half —
--     the "Replace bag?" client UX is still yours.
--   • product is_active / not deleted / store approved+active checks — the
--     old client inserts validated none of this.
--
-- NOT here (unchanged behavior, other tasks): delivery-fee policy (G9/W3.6),
-- try-window duration source (A3 — the 7-min placeholder below matches the
-- current checkout and is reset by the rider-arrival flow).

-- ============================================================
-- 1. Idempotency flag: has this item's unit got a live reservation?
-- ============================================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN order_items.stock_reserved IS
  'True while this unit holds a product_variants.reserved_qty unit (migration 047). Consumed on keep (stock−1, reserved−1), released on return / order cancel (reserved−1). Pre-047 orders: false.';

-- ============================================================
-- 2. place_order(): the one way an order comes into existence.
--    p_items: [{"product_id": uuid, "color_name": text|null,
--               "size": text|null, "quantity": int}]
-- ============================================================
CREATE OR REPLACE FUNCTION place_order(
  p_items          JSONB,
  p_payment_method TEXT DEFAULT 'razorpay'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_line       JSONB;
  v_product    RECORD;
  v_variant    RECORD;
  v_qty        INT;
  v_store_ids  UUID[] := '{}';
  v_unit_price NUMERIC;
  v_subtotal   NUMERIC := 0;
  v_settings   RECORD;
  v_delivery   NUMERIC;
  v_order      RECORD;
  -- resolved lines carried between the two passes
  v_resolved   JSONB := '[]'::jsonb;
  v_need       RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  -- ── Pass 1: resolve + validate every line (no writes yet) ───────────────
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_line->>'quantity')::INT, 1);
    IF v_qty < 1 OR v_qty > 10 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT p.id, p.name, p.store_id, p.base_price, p.discounted_price,
           s.onboarding_status, s.is_active AS store_active
      INTO v_product
      FROM products p
      JOIN stores s ON s.id = p.store_id
     WHERE p.id = (v_line->>'product_id')::UUID
       AND p.is_active AND NOT p.is_deleted;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', COALESCE(v_line->>'product_id', '?');
    END IF;
    IF v_product.onboarding_status IS DISTINCT FROM 'approved' OR NOT v_product.store_active THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', v_product.name;
    END IF;

    v_store_ids := array_append(v_store_ids, v_product.store_id);

    -- Variant: the chosen colour+size if given; otherwise the first variant
    -- WITH availability. An explicitly chosen size that's out of stock is an
    -- error — never silently substitute a different size (old G3 behavior).
    SELECT pv.id, pv.size, pc.color_name, pv.available_qty
      INTO v_variant
      FROM product_variants pv
      JOIN product_colors pc ON pc.id = pv.color_id
     WHERE pv.product_id = v_product.id
       AND pv.is_available
       AND (v_line->>'color_name' IS NULL OR pc.color_name = v_line->>'color_name')
       AND (v_line->>'size'       IS NULL OR pv.size       = v_line->>'size')
     ORDER BY (pv.available_qty >= v_qty) DESC, pc.sort_order, pv.size
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', v_product.name;
    END IF;
    IF v_variant.available_qty < v_qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:% (%)', v_product.name, v_variant.size;
    END IF;

    -- Server-side price (G2): the client's number is never consulted.
    v_unit_price := COALESCE(NULLIF(v_product.discounted_price, 0), v_product.base_price);
    v_subtotal   := v_subtotal + v_unit_price * v_qty;

    v_resolved := v_resolved || jsonb_build_object(
      'product_id',   v_product.id,
      'product_name', v_product.name,
      'variant_id',   v_variant.id,
      'color_name',   v_variant.color_name,
      'size',         v_variant.size,
      'unit_price',   v_unit_price,
      'quantity',     v_qty,
      'image_url',    v_line->>'image_url'
    );
  END LOOP;

  -- Single-store cart (G1 backstop, decided 2026-07-14).
  IF (SELECT COUNT(DISTINCT s) FROM unnest(v_store_ids) s) > 1 THEN
    RAISE EXCEPTION 'MULTI_STORE_CART';
  END IF;

  -- ── Pass 2: reserve stock under row locks (consistent order = no deadlock) ─
  FOR v_need IN
    SELECT (r->>'variant_id')::UUID AS variant_id,
           SUM((r->>'quantity')::INT) AS qty,
           MIN(r->>'product_name') AS pname,
           MIN(r->>'size') AS psize
      FROM jsonb_array_elements(v_resolved) r
     GROUP BY 1 ORDER BY 1
  LOOP
    PERFORM 1 FROM product_variants WHERE id = v_need.variant_id FOR UPDATE;
    UPDATE product_variants
       SET reserved_qty = reserved_qty + v_need.qty
     WHERE id = v_need.variant_id
       AND available_qty >= v_need.qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:% (%)', v_need.pname, v_need.psize;
    END IF;
  END LOOP;

  -- ── Fees from Admin → System Settings (unchanged model; G9 reworks later) ─
  SELECT delivery_fee, free_delivery_above, rider_fee
    INTO v_settings FROM system_settings WHERE id = 1;
  v_delivery := CASE
    WHEN COALESCE(v_settings.free_delivery_above, 0) > 0
     AND v_subtotal >= v_settings.free_delivery_above THEN 0
    ELSE COALESCE(v_settings.delivery_fee, 0) END;

  -- ── Create the order + per-unit items + placeholder try session ─────────
  INSERT INTO orders (user_id, order_number, status, subtotal, deposit_total,
                      delivery_fee, rider_fee, discount_amount, final_amount,
                      coupon_discount, payment_status, payment_method)
  VALUES (v_user, '', 'pending', v_subtotal, 0,
          v_delivery, COALESCE(v_settings.rider_fee, 0), 0, v_subtotal + v_delivery,
          0, 'pending',
          CASE WHEN p_payment_method IN ('razorpay','cod','wallet')
               THEN p_payment_method::payment_method ELSE 'razorpay'::payment_method END)
  RETURNING id, order_number INTO v_order;

  INSERT INTO order_items (order_id, product_id, variant_id, product_name,
                           color_name, size, image_url, price_at_order,
                           deposit_at_order, decision, stock_reserved)
  SELECT v_order.id,
         (r->>'product_id')::UUID,
         (r->>'variant_id')::UUID,
         r->>'product_name',
         r->>'color_name',
         r->>'size',
         NULLIF(r->>'image_url', ''),
         (r->>'unit_price')::NUMERIC,
         0, 'pending', true
    FROM jsonb_array_elements(v_resolved) r
    CROSS JOIN generate_series(1, (r->>'quantity')::INT);

  -- Placeholder try session (the rider-arrival flow resets it — A3 wires the
  -- duration to system_settings; keep parity with the legacy path for now).
  INSERT INTO try_sessions (order_id, started_at, deadline_at, status)
  VALUES (v_order.id, NOW(), NOW() + INTERVAL '7 minutes', 'active');

  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number);
END;
$$;

REVOKE ALL ON FUNCTION place_order(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order(JSONB, TEXT) TO authenticated;

-- ============================================================
-- 3. Consume/release on item decision (BEFORE UPDATE trigger — catches the
--    customer keep-settle, returnItem, and the 027 auto-return sweep).
-- ============================================================
CREATE OR REPLACE FUNCTION handle_item_stock_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stock_reserved
     AND OLD.decision = 'pending'
     AND NEW.decision IS DISTINCT FROM OLD.decision THEN
    IF NEW.decision = 'keep' THEN
      -- Unit sold: it leaves both the shelf and the reservation.
      UPDATE product_variants
         SET stock_qty    = GREATEST(stock_qty - 1, 0),
             reserved_qty = GREATEST(reserved_qty - 1, 0)
       WHERE id = OLD.variant_id;
      NEW.stock_reserved := false;
    ELSIF NEW.decision = 'return' THEN
      -- Handed back to the rider: back on the shelf.
      UPDATE product_variants
         SET reserved_qty = GREATEST(reserved_qty - 1, 0)
       WHERE id = OLD.variant_id;
      NEW.stock_reserved := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_stock_transition ON order_items;
CREATE TRIGGER trg_item_stock_transition
  BEFORE UPDATE OF decision ON order_items
  FOR EACH ROW EXECUTE FUNCTION handle_item_stock_transition();

-- ============================================================
-- 4. Release everything still reserved when an order is cancelled
--    (admin Cancel, rider_fail_delivery 033, expire_stale_offers 036).
--    The order_items UPDATE below does not change `decision`, so the item
--    trigger above ignores it — no double release.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_order_cancel_stock_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE product_variants pv
       SET reserved_qty = GREATEST(pv.reserved_qty - r.units, 0)
      FROM (SELECT variant_id, COUNT(*) AS units
              FROM order_items
             WHERE order_id = NEW.id AND stock_reserved
             GROUP BY variant_id) r
     WHERE pv.id = r.variant_id;

    UPDATE order_items
       SET stock_reserved = false
     WHERE order_id = NEW.id AND stock_reserved;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancel_stock_release ON orders;
CREATE TRIGGER trg_order_cancel_stock_release
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_cancel_stock_release();


-- ==================== config singleton seed (Part C.3) ====================
INSERT INTO system_settings (id, site_name, contact_email, support_phone,
  try_window_minutes, delivery_fee, free_delivery_above, commission_rate,
  offer_expiry_minutes, rider_fee)
VALUES (1, 'Fitzo', 'support@fitzo.in', '', 60, 49, 999, 15, 120, 40)
ON CONFLICT (id) DO NOTHING;

COMMIT;
