import express from "express";
import auth from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import pool from "../db.js";

const router = express.Router();

// Get all inventory items
router.get("/", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id, name, quantity, unit, expire_date, 
        low_stock_threshold, category, cost_per_unit, 
        created_at, updated_at,
        CASE 
          WHEN expire_date IS NOT NULL AND expire_date < CURRENT_DATE THEN 'expired'
          WHEN expire_date IS NOT NULL AND expire_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'expiring_soon'
          WHEN quantity <= low_stock_threshold THEN 'low_stock'
          ELSE 'normal'
        END as status
      FROM inventory_items 
      ORDER BY name`
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    // Check if it's a column/table doesn't exist error
    if (err.code === '42703' || err.code === '42P01' || err.message.includes('does not exist')) {
      return res.status(500).json({ 
        message: "Database schema not updated. Please run: npm run migrate:inventory (in the backend folder)",
        error: err.message,
        fix: "Run 'npm run migrate:inventory' in the backend directory to fix this issue"
      });
    }
    return res.status(500).json({ message: "Failed to fetch inventory", error: err.message });
  }
});

// Get inventory item by ID
router.get("/:id", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM inventory_items WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching inventory item:", err);
    return res.status(500).json({ message: "Failed to fetch inventory item", error: err.message });
  }
});

// Create inventory item
router.post("/", auth, authorize("ADMIN"), async (req, res) => {
  const {
    name,
    quantity = 0,
    unit = "grams",
    expire_date,
    low_stock_threshold = 0,
    category,
    cost_per_unit,
  } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  // Validate unit
  const validUnits = ["grams", "kilograms", "pieces", "liters", "ml"];
  if (!validUnits.includes(unit)) {
    return res.status(400).json({ message: "Invalid unit. Must be one of: " + validUnits.join(", ") });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory_items 
       (name, quantity, unit, expire_date, low_stock_threshold, 
        category, cost_per_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, quantity, unit, expire_date || null, low_stock_threshold, 
       category || null, cost_per_unit || null]
    );

    // Log the transaction (if table exists)
    try {
      await pool.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity, unit, notes, created_by)
         VALUES ($1, 'ADD', $2, $3, $4, $5)`,
        [rows[0].id, quantity, unit, "Initial stock", req.user?.username || "SYSTEM"]
      );
    } catch (txErr) {
      // Transaction table might not exist yet, that's okay
      console.warn("Could not log transaction:", txErr.message);
    }

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating inventory item:", err);
    return res.status(500).json({ message: "Failed to create inventory item", error: err.message });
  }
});

// Update inventory item
router.put("/:id", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const {
    name,
    quantity,
    unit,
    expire_date,
    low_stock_threshold,
    category,
    cost_per_unit,
  } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    // Get current quantity for transaction log if quantity changed
    const currentItem = await pool.query(
      `SELECT quantity, unit FROM inventory_items WHERE id = $1`,
      [id]
    );

    const { rows } = await pool.query(
      `UPDATE inventory_items 
       SET name = $1, quantity = COALESCE($2, quantity), unit = COALESCE($3, unit),
           expire_date = $4, low_stock_threshold = COALESCE($5, low_stock_threshold),
           category = $6, cost_per_unit = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, quantity, unit, expire_date || null, low_stock_threshold,
       category || null, cost_per_unit || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Log quantity change if it was adjusted (if transaction table exists)
    if (quantity !== undefined && currentItem.rows.length > 0) {
      const oldQty = parseFloat(currentItem.rows[0].quantity);
      const newQty = parseFloat(quantity);
      const diff = newQty - oldQty;
      
      if (Math.abs(diff) > 0.001) { // Only log if there's a meaningful change
        try {
          await pool.query(
            `INSERT INTO inventory_transactions 
             (inventory_item_id, transaction_type, quantity, unit, notes, created_by)
             VALUES ($1, 'ADJUST', $2, $3, $4, $5)`,
            [id, Math.abs(diff), unit || currentItem.rows[0].unit, 
             diff > 0 ? "Stock adjustment (increase)" : "Stock adjustment (decrease)",
             req.user?.username || "SYSTEM"]
          );
        } catch (txErr) {
          // Transaction table might not exist, that's okay
          console.warn("Could not log transaction:", txErr.message);
        }
      }
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Error updating inventory item:", err);
    return res.status(500).json({ message: "Failed to update inventory item", error: err.message });
  }
});

// Delete inventory item
router.delete("/:id", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM inventory_items WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    return res.json({ message: "Inventory item deleted successfully" });
  } catch (err) {
    console.error("Error deleting inventory item:", err);
    return res.status(500).json({ message: "Failed to delete inventory item", error: err.message });
  }
});

// Add stock to inventory item
router.post("/:id/add", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: "Quantity must be greater than 0" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE inventory_items 
       SET quantity = quantity + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [quantity, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Log transaction (if table exists)
    try {
      await pool.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity, unit, notes, created_by)
         VALUES ($1, 'ADD', $2, $3, $4, $5)`,
        [id, quantity, rows[0].unit, "Stock added", req.user?.username || "SYSTEM"]
      );
    } catch (txErr) {
      console.warn("Could not log transaction:", txErr.message);
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Error adding stock:", err);
    return res.status(500).json({ message: "Failed to add stock", error: err.message });
  }
});

// Remove stock from inventory item
router.post("/:id/remove", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: "Quantity must be greater than 0" });
  }

  try {
    // Check current quantity
    const current = await pool.query(
      "SELECT quantity FROM inventory_items WHERE id = $1",
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const currentQty = parseFloat(current.rows[0].quantity);
    if (currentQty < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    const { rows } = await pool.query(
      `UPDATE inventory_items 
       SET quantity = quantity - $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [quantity, id]
    );

    // Log transaction (if table exists)
    try {
      await pool.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity, unit, notes, created_by)
         VALUES ($1, 'REMOVE', $2, $3, $4, $5)`,
        [id, quantity, rows[0].unit, "Stock removed", req.user?.username || "SYSTEM"]
      );
    } catch (txErr) {
      console.warn("Could not log transaction:", txErr.message);
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Error removing stock:", err);
    return res.status(500).json({ message: "Failed to remove stock", error: err.message });
  }
});

// Get inventory alerts (low stock, expiring soon, expired)
router.get("/alerts/summary", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const lowStock = await pool.query(
      `SELECT id, name, quantity, unit, low_stock_threshold
       FROM inventory_items 
       WHERE quantity <= low_stock_threshold AND low_stock_threshold > 0
       ORDER BY (quantity / NULLIF(low_stock_threshold, 0)) ASC`
    );

    const expiringSoon = await pool.query(
      `SELECT id, name, quantity, unit, expire_date
       FROM inventory_items 
       WHERE expire_date IS NOT NULL 
       AND expire_date > CURRENT_DATE 
       AND expire_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY expire_date ASC`
    );

    const expired = await pool.query(
      `SELECT id, name, quantity, unit, expire_date
       FROM inventory_items 
       WHERE expire_date IS NOT NULL AND expire_date < CURRENT_DATE
       ORDER BY expire_date ASC`
    );

    return res.json({
      lowStock: lowStock.rows,
      expiringSoon: expiringSoon.rows,
      expired: expired.rows,
    });
  } catch (err) {
    console.error("Error fetching inventory alerts:", err);
    return res.status(500).json({ message: "Failed to fetch alerts", error: err.message });
  }
});

// Get inventory transactions for an item
router.get("/:id/transactions", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM inventory_transactions 
       WHERE inventory_item_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    return res.status(500).json({ message: "Failed to fetch transactions", error: err.message });
  }
});

// Get product-inventory mappings (Bill of Materials) for a product
router.get("/product/:productId/bom", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { productId } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        pi.id, pi.product_id, pi.inventory_item_id, pi.quantity_required, pi.unit,
        ii.name as inventory_item_name, ii.unit as inventory_unit, ii.quantity as current_stock
       FROM product_inventory pi
       JOIN inventory_items ii ON pi.inventory_item_id = ii.id
       WHERE pi.product_id = $1
       ORDER BY ii.name`,
      [productId] // Use productId as-is (can be UUID or INT depending on schema)
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching BOM:", err);
    if (err.code === '42P01') { // Table doesn't exist
      return res.status(500).json({ 
        message: "product_inventory table does not exist. Please run: npm run migrate:product-inventory",
        error: err.message
      });
    }
    return res.status(500).json({ message: "Failed to fetch BOM", error: err.message });
  }
});

// Add inventory item to product (Bill of Materials)
router.post("/product/:productId/bom", auth, authorize("ADMIN"), async (req, res) => {
  const { productId } = req.params;
  const { inventory_item_id, quantity_required, unit } = req.body;

  if (!inventory_item_id || !quantity_required || quantity_required <= 0) {
    return res.status(400).json({ message: "Inventory item ID and positive quantity required are required" });
  }

  // Validate inventory_item_id is a number (inventory_items always use INT)
  const inventoryItemIdNum = parseInt(inventory_item_id, 10);
  if (isNaN(inventoryItemIdNum)) {
    return res.status(400).json({ 
      message: "Invalid inventory item ID format. Inventory item ID must be a numeric value.",
      error: `Expected numeric ID, got: ${inventory_item_id}`
    });
  }

  try {
    // Verify product exists (productId can be UUID or INT depending on schema)
    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Verify inventory item exists
    const inventoryCheck = await pool.query('SELECT id FROM inventory_items WHERE id = $1', [inventoryItemIdNum]);
    if (inventoryCheck.rows.length === 0) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const { rows } = await pool.query(
      `INSERT INTO product_inventory (product_id, inventory_item_id, quantity_required, unit)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [productId, inventoryItemIdNum, quantity_required, unit || "grams"] // productId as-is (UUID or INT)
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating BOM entry:", err);
    if (err.code === "23505") {
      return res.status(400).json({ message: "This inventory item is already mapped to this product" });
    }
    if (err.code === '42P01') { // Table doesn't exist
      return res.status(500).json({ 
        message: "product_inventory table does not exist. Please run: npm run migrate:product-inventory",
        error: err.message
      });
    }
    return res.status(500).json({ message: "Failed to create BOM entry", error: err.message });
  }
});

// Update product-inventory mapping
router.put("/bom/:id", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { quantity_required, unit } = req.body;

  if (!quantity_required || quantity_required <= 0) {
    return res.status(400).json({ message: "Positive quantity required" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE product_inventory 
       SET quantity_required = $1, unit = COALESCE($2, unit)
       WHERE id = $3
       RETURNING *`,
      [quantity_required, unit, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "BOM entry not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Error updating BOM:", err);
    return res.status(500).json({ message: "Failed to update BOM", error: err.message });
  }
});

// Delete product-inventory mapping
router.delete("/bom/:id", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM product_inventory WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "BOM entry not found" });
    }

    return res.json({ message: "BOM entry deleted successfully" });
  } catch (err) {
    console.error("Error deleting BOM:", err);
    return res.status(500).json({ message: "Failed to delete BOM entry", error: err.message });
  }
});

export default router;

