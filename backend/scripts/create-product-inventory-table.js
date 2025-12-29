import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createProductInventoryTable() {
  const client = await pool.connect();
  try {
    console.log("🔄 Creating product_inventory table...");
    
    // First check if products table uses UUID or INT
    const checkProductsType = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'id'
    `);
    
    let productIdType = 'INT';
    if (checkProductsType.rows.length > 0) {
      const dataType = checkProductsType.rows[0].data_type;
      console.log(`📊 Products table ID type: ${dataType}`);
      if (dataType === 'uuid') {
        productIdType = 'UUID';
      }
    }

    // Drop table if exists
    await client.query("DROP TABLE IF EXISTS product_inventory CASCADE");

    // Create table with appropriate type
    if (productIdType === 'UUID') {
      console.log("📝 Creating product_inventory table with UUID product_id...");
      await client.query(`
        CREATE TABLE product_inventory (
          id SERIAL PRIMARY KEY,
          product_id UUID REFERENCES products(id) ON DELETE CASCADE,
          inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
          quantity_required NUMERIC(10,3) NOT NULL,
          unit VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(product_id, inventory_item_id)
        )
      `);
    } else {
      console.log("📝 Creating product_inventory table with INT product_id...");
      await client.query(`
        CREATE TABLE product_inventory (
          id SERIAL PRIMARY KEY,
          product_id INT REFERENCES products(id) ON DELETE CASCADE,
          inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
          quantity_required NUMERIC(10,3) NOT NULL,
          unit VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(product_id, inventory_item_id)
        )
      `);
    }

    // Create indexes
    await client.query("CREATE INDEX idx_product_inventory_product_id ON product_inventory(product_id)");
    await client.query("CREATE INDEX idx_product_inventory_inventory_item_id ON product_inventory(inventory_item_id)");
    
    console.log("✅ product_inventory table created successfully!");
    console.log(`📦 Table uses ${productIdType} for product_id`);

    // Also create inventory_transactions table if it doesn't exist
    console.log("🔄 Creating inventory_transactions table...");
    await client.query(`
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
      )
    `);
    
    await client.query("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(inventory_item_id)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at)");
    
    console.log("✅ inventory_transactions table created successfully!");
  } catch (err) {
    console.error("❌ Failed to create product_inventory table:", err.message);
    console.error("\nError details:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createProductInventoryTable();

