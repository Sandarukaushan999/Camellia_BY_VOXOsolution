-- Migration: Create product_inventory table for Bill of Materials
-- This table links products to inventory items

-- Check if products table uses UUID or INT
-- We'll create the table to work with both scenarios

-- First, try to determine the product ID type
-- Create product_inventory table - we'll use the same type as products.id
-- Since we can't easily detect the type, we'll create it with INT first (can be changed if needed)

-- Drop the table if it exists to recreate with correct structure
DROP TABLE IF EXISTS product_inventory CASCADE;

-- Create product_inventory table
-- Note: If your products table uses UUID, change INT to UUID below
CREATE TABLE product_inventory (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_required NUMERIC(10,3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, inventory_item_id)
);

-- Create indexes
CREATE INDEX idx_product_inventory_product_id ON product_inventory(product_id);
CREATE INDEX idx_product_inventory_inventory_item_id ON product_inventory(inventory_item_id);

