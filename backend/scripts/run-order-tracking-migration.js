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
    console.log("Running order tracking migration...");
    
    const migrationSQL = readFileSync(
      join(__dirname, "../db/migrations/005_add_order_tracking.sql"),
      "utf8"
    );

    await client.query("BEGIN");
    await client.query(migrationSQL);
    await client.query("COMMIT");
    
    console.log("✅ Migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

