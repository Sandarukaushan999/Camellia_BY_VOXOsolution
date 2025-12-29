-- Migration: Add missing columns to inventory_items table if they don't exist
-- Run this to fix the column "quantity" does not exist error

-- Check and add quantity column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='quantity') THEN
    ALTER TABLE inventory_items ADD COLUMN quantity NUMERIC(10,3) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Check and add unit column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='unit') THEN
    ALTER TABLE inventory_items ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'grams' 
      CHECK (unit IN ('grams', 'kilograms', 'pieces', 'liters', 'ml'));
  END IF;
END $$;

-- Check and add expire_date column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='expire_date') THEN
    ALTER TABLE inventory_items ADD COLUMN expire_date DATE;
  END IF;
END $$;

-- Check and add low_stock_threshold column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='low_stock_threshold') THEN
    ALTER TABLE inventory_items ADD COLUMN low_stock_threshold NUMERIC(10,3) DEFAULT 0;
  END IF;
END $$;

-- Check and add category column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='category') THEN
    ALTER TABLE inventory_items ADD COLUMN category VARCHAR(50);
  END IF;
END $$;

-- Check and add cost_per_unit column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='cost_per_unit') THEN
    ALTER TABLE inventory_items ADD COLUMN cost_per_unit NUMERIC(10,2);
  END IF;
END $$;

-- Check and add updated_at column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='inventory_items' AND column_name='updated_at') THEN
    ALTER TABLE inventory_items ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Make sure the table has the basic required columns
-- If inventory_items table doesn't exist at all, create it
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'grams' CHECK (unit IN ('grams', 'kilograms', 'pieces', 'liters', 'ml')),
  expire_date DATE,
  low_stock_threshold NUMERIC(10,3) DEFAULT 0,
  category VARCHAR(50),
  cost_per_unit NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Optional columns (barcode, supplier, location, notes) are not used by the application
-- but are left in the database schema to avoid data loss. The application code ignores them.

