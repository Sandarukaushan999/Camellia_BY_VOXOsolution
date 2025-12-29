-- Migration: Add inventory tables and related structures
-- Run this script to update your database schema

-- Inventory Items table for raw materials and ingredients
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'grams' CHECK (unit IN ('grams', 'kilograms', 'pieces', 'liters', 'ml')),
  barcode VARCHAR(100) UNIQUE,
  expire_date DATE,
  low_stock_threshold NUMERIC(10,3) DEFAULT 0,
  category VARCHAR(50),
  cost_per_unit NUMERIC(10,2),
  supplier VARCHAR(100),
  location VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product to Inventory mapping (Bill of Materials)
CREATE TABLE IF NOT EXISTS product_inventory (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_required NUMERIC(10,3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, inventory_item_id)
);

-- Inventory transactions log (for tracking stock movements)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('ADD', 'REMOVE', 'ADJUST', 'EXPIRED', 'SALE')),
  quantity NUMERIC(10,3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  reference_id INT, -- Can reference order_id or other relevant ID
  reference_type VARCHAR(50), -- 'ORDER', 'ADJUSTMENT', 'EXPIRY', etc.
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_expire_date ON inventory_items(expire_date);
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_inventory_item_id ON product_inventory(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);

-- Add unique constraint to product_inventory to prevent duplicate mappings
-- Note: Run this manually if the constraint doesn't exist:
-- ALTER TABLE product_inventory ADD CONSTRAINT unique_product_inventory 
--   UNIQUE(product_id, inventory_item_id);

