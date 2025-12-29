CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'CASHIER'))
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  total NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  qty INT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

-- Inventory Items table for raw materials and ingredients
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

-- Expenses table for tracking business expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(20) DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER')),
  receipt_number VARCHAR(100),
  vendor VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);






