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
