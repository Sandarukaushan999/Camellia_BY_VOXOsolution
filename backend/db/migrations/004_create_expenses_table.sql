-- Migration: Create expenses table for expense management
-- Run this script to add expense tracking to your database

-- Drop table if exists to recreate with correct structure
DROP TABLE IF EXISTS expenses CASCADE;

CREATE TABLE expenses (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

