-- Migration 003: add customer UPDATE policy on order_items
-- Required so customers can set keep/return decisions during the try window.
-- Run in Supabase SQL Editor after migration 002.

CREATE POLICY order_items_update ON order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
