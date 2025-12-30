-- Add created_by and order_type columns to orders table for reporting
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='created_by') THEN
    ALTER TABLE orders ADD COLUMN created_by VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='order_type') THEN
    ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) CHECK (order_type IN ('DINE-IN', 'TAKEAWAY', 'DELIVERY')) DEFAULT 'DINE-IN';
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

