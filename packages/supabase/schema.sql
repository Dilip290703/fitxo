-- ============================================================
-- FITZO — Complete PostgreSQL Schema
-- Fashion Try-and-Buy Platform
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- optional: for geo queries

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
