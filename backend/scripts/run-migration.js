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

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("🔄 Running inventory migration...");
    
    // Read the migration file
    const migrationPath = join(__dirname, "../db/migrations/002_add_missing_inventory_columns.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    
    // Execute the migration
    await client.query("BEGIN");
    await client.query(migrationSQL);
    await client.query("COMMIT");
    
    console.log("✅ Migration completed successfully!");
    console.log("📦 Inventory tables and columns have been created/updated.");
    console.log("\nYou can now restart your backend server and use the inventory system.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err.message);
    console.error("\nError details:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

