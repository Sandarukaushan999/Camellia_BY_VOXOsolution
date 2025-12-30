import express from "express";
import multer from "multer";
import auth from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import pool from "../db.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// List products (ADMIN only for management) - includes stock for inventory
router.get("/products", auth, authorize("ADMIN"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, price, category, "isActive" as is_active, stock FROM products ORDER BY name'
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
});

// Get active products for POS (both ADMIN and CASHIER)
router.get("/products/pos", auth, authorize("ADMIN", "CASHIER"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, price, category FROM products WHERE "isActive" = true ORDER BY category, name'
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching POS products:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
});

// Create product
router.post("/products", auth, authorize("ADMIN"), async (req, res) => {
  const { name, price, category, is_active: isActive = true } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ message: "Name and price are required" });
  }

  // Ensure price is a number
  const priceNum = parseFloat(price);
  if (isNaN(priceNum) || priceNum < 0) {
    return res.status(400).json({ message: "Price must be a valid positive number" });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO products (name, price, category, "isActive", stock) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, price, category, "isActive" as is_active',
      [name, priceNum, category || null, isActive, 0]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating product:", err);
    console.error("Error message:", err.message);
    console.error("Error code:", err.code);
    console.error("Error detail:", err.detail);
    console.error("Error stack:", err.stack);
    return res.status(500).json({ message: "Failed to create product", error: err.message });
  }
});

// Update product
router.put("/products/:id", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { name, price, category, is_active: isActive, stock } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE products SET name = $1, price = $2, category = $3, "isActive" = $4, stock = COALESCE($5, stock) WHERE id = $6 RETURNING id, name, price, category, "isActive" as is_active, stock',
      [name, price || null, category || null, isActive !== undefined ? isActive : true, stock, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Error updating product:", err);
    return res.status(500).json({ message: "Failed to update product", error: err.message });
  }
});

// Delete product
router.delete("/products/:id", auth, authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

// Dashboard stats
router.get("/dashboard/stats", auth, authorize("ADMIN"), async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's sales
    const todaySales = await pool.query(
      "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM orders WHERE created_at >= $1",
      [today]
    );

    // Yesterday's sales for comparison
    const yesterdaySales = await pool.query(
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= $1 AND created_at < $2",
      [yesterday, today]
    );

    const todayTotal = parseFloat(todaySales.rows[0].total || 0);
    const yesterdayTotal = parseFloat(yesterdaySales.rows[0].total || 0);
    const orderCount = parseInt(todaySales.rows[0].count || 0);
    const avgOrderValue = orderCount > 0 ? todayTotal / orderCount : 0;
    const salesChange = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100).toFixed(1) : 0;

    // Active orders (last 30 minutes)
    const activeOrders = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE created_at >= NOW() - INTERVAL '30 minutes'"
    );

    // Net profit (assuming 30% margin for demo)
    const netProfit = todayTotal * 0.3;

    return res.json({
      todaySales: todayTotal.toFixed(2),
      salesChange: parseFloat(salesChange),
      totalOrders: orderCount,
      avgOrderValue: avgOrderValue.toFixed(2),
      netProfit: netProfit.toFixed(2),
      activeOrders: parseInt(activeOrders.rows[0].count || 0),
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

// Dashboard sales chart (last 7 days)
router.get("/dashboard/sales-chart", auth, authorize("ADMIN"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DATE(created_at) as day, COALESCE(SUM(total), 0) as total 
       FROM orders 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at) 
       ORDER BY day ASC`
    );
    return res.json(rows.map(r => ({ day: r.day, total: parseFloat(r.total || 0) })));
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch sales chart" });
  }
});

// Order breakdown by type
router.get("/dashboard/order-breakdown", auth, authorize("ADMIN"), async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { rows } = await pool.query(
      `SELECT payment_method, COUNT(*) as count, SUM(total) as total 
       FROM orders 
       WHERE created_at >= $1 
       GROUP BY payment_method`,
      [today]
    );

    const total = rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const breakdown = rows.map(r => ({
      type: r.payment_method,
      count: parseInt(r.count),
      percentage: total > 0 ? ((parseInt(r.count) / total) * 100).toFixed(0) : 0,
      total: parseFloat(r.total || 0),
    }));

    return res.json(breakdown);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch order breakdown" });
  }
});

// Top selling items
router.get("/dashboard/top-items", auth, authorize("ADMIN"), async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { rows } = await pool.query(
      `SELECT p.name, SUM(oi.qty) as total_qty, SUM(oi.qty * oi.price) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.created_at >= $1
       GROUP BY p.name
       ORDER BY total_qty DESC
       LIMIT 5`,
      [today]
    );

    return res.json(rows.map(r => ({
      name: r.name,
      qty: parseInt(r.total_qty || 0),
      revenue: parseFloat(r.revenue || 0).toFixed(2),
    })));
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch top items" });
  }
});

// Recent orders
router.get("/dashboard/recent-orders", auth, authorize("ADMIN"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, total, payment_method, created_at 
       FROM orders 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    return res.json(rows.map(r => ({
      id: r.id,
      total: parseFloat(r.total || 0).toFixed(2),
      paymentMethod: r.payment_method,
      createdAt: r.created_at,
    })));
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch recent orders" });
  }
});

// Comprehensive Sales Reports with detailed data
router.get("/reports/sales", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { days = 30, orderType, paymentMethod, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        DATE(created_at) as day,
        SUM(total) as total,
        COUNT(*) as order_count
      FROM orders 
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    // Date filtering
    if (startDate && endDate) {
      query += ` AND DATE(created_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else if (days && !startDate) {
      const daysInt = parseInt(days) || 30;
      query += ` AND created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'`;
    }
    
    if (orderType && orderType !== "ALL") {
      query += ` AND order_type = $${paramCount}`;
      params.push(orderType);
      paramCount++;
    }
    
    if (paymentMethod && paymentMethod !== "ALL") {
      query += ` AND payment_method = $${paramCount}`;
      params.push(paymentMethod);
      paramCount++;
    }
    
    query += ` GROUP BY DATE(created_at) ORDER BY day DESC`;
    
    const { rows } = await pool.query(query, params);
    return res.json(rows.map(r => ({
      day: r.day,
      total: parseFloat(r.total || 0),
      orderCount: parseInt(r.order_count || 0),
    })));
  } catch (err) {
    console.error("Error fetching sales reports:", err);
    return res.status(500).json({ message: "Failed to fetch sales reports" });
  }
});

// Detailed Sales Report with all order information
router.get("/reports/sales/detailed", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { days = 30, orderType, paymentMethod, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        o.id,
        o.total,
        o.payment_method,
        o.order_type,
        o.created_at,
        o.created_by
      FROM orders o
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (startDate && endDate) {
      query += ` AND DATE(o.created_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else if (days && !startDate) {
      const daysInt = parseInt(days) || 30;
      query += ` AND o.created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'`;
    }
    
    if (orderType && orderType !== "ALL") {
      query += ` AND o.order_type = $${paramCount}`;
      params.push(orderType);
      paramCount++;
    }
    
    if (paymentMethod && paymentMethod !== "ALL") {
      query += ` AND o.payment_method = $${paramCount}`;
      params.push(paymentMethod);
      paramCount++;
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT 1000`;
    
    const { rows } = await pool.query(query, params);
    return res.json(rows.map(r => ({
      id: r.id,
      total: parseFloat(r.total || 0),
      paymentMethod: r.payment_method,
      orderType: r.order_type || "DINE-IN",
      createdAt: r.created_at,
      createdBy: r.created_by || "SYSTEM",
    })));
  } catch (err) {
    console.error("Error fetching detailed sales:", err);
    return res.status(500).json({ message: "Failed to fetch detailed sales" });
  }
});

// Monthly Sales Summary
router.get("/reports/sales/monthly", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const { rows } = await pool.query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(total) as total,
        COUNT(*) as order_count
      FROM orders 
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC`,
      [year]
    );
    
    return res.json(rows.map(r => ({
      month: r.month,
      total: parseFloat(r.total || 0),
      orderCount: parseInt(r.order_count || 0),
    })));
  } catch (err) {
    console.error("Error fetching monthly sales:", err);
    return res.status(500).json({ message: "Failed to fetch monthly sales" });
  }
});

// Payment Method Reports
router.get("/reports/payments", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { days = 30, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total) as total
      FROM orders
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (startDate && endDate) {
      query += ` AND DATE(created_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else if (days && !startDate) {
      const daysInt = parseInt(days) || 30;
      query += ` AND created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'`;
    }
    
    query += ` GROUP BY payment_method ORDER BY total DESC`;
    
    const { rows } = await pool.query(query, params);
    const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    
    return res.json({
      methods: rows.map(r => ({
        method: r.payment_method,
        count: parseInt(r.count || 0),
        total: parseFloat(r.total || 0),
        percentage: totalAmount > 0 ? ((parseFloat(r.total || 0) / totalAmount) * 100).toFixed(2) : 0,
      })),
      totalAmount,
    });
  } catch (err) {
    console.error("Error fetching payment reports:", err);
    return res.status(500).json({ message: "Failed to fetch payment reports" });
  }
});

// Inventory Reports
router.get("/reports/inventory", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { days = 30, startDate, endDate } = req.query;
    
    // Get inventory transactions
    let query = `
      SELECT 
        it.transaction_type,
        it.quantity,
        it.unit,
        it.created_at,
        it.created_by,
        it.notes,
        ii.name as item_name,
        ii.category
      FROM inventory_transactions it
      JOIN inventory_items ii ON it.inventory_item_id = ii.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (startDate && endDate) {
      query += ` AND DATE(it.created_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else if (days && !startDate) {
      const daysInt = parseInt(days) || 30;
      query += ` AND it.created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'`;
    }
    
    query += ` ORDER BY it.created_at DESC LIMIT 500`;
    
    const { rows } = await pool.query(query, params);
    
    // Get current inventory summary
    const inventorySummary = await pool.query(`
      SELECT 
        category,
        COUNT(*) as item_count,
        SUM(quantity * COALESCE(cost_per_unit, 0)) as total_value
      FROM inventory_items
      GROUP BY category
      ORDER BY category
    `);
    
    // Get low stock items
    const lowStock = await pool.query(`
      SELECT id, name, quantity, unit, low_stock_threshold, category
      FROM inventory_items
      WHERE quantity <= low_stock_threshold AND low_stock_threshold > 0
      ORDER BY (quantity / NULLIF(low_stock_threshold, 0)) ASC
    `);
    
    // Get expired items
    const expired = await pool.query(`
      SELECT id, name, quantity, unit, expire_date, category
      FROM inventory_items
      WHERE expire_date IS NOT NULL AND expire_date < CURRENT_DATE
      ORDER BY expire_date ASC
    `);
    
    return res.json({
      transactions: rows.map(r => ({
        type: r.transaction_type,
        quantity: parseFloat(r.quantity || 0),
        unit: r.unit,
        createdAt: r.created_at,
        createdBy: r.created_by || "SYSTEM",
        itemName: r.item_name,
        category: r.category,
        notes: r.notes,
      })),
      summary: inventorySummary.rows.map(r => ({
        category: r.category || "Uncategorized",
        itemCount: parseInt(r.item_count || 0),
        totalValue: parseFloat(r.total_value || 0),
      })),
      lowStock: lowStock.rows,
      expired: expired.rows,
    });
  } catch (err) {
    console.error("Error fetching inventory reports:", err);
    return res.status(500).json({ message: "Failed to fetch inventory reports" });
  }
});

// Expenses Reports
router.get("/reports/expenses", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { days = 30, category, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        id,
        title,
        description,
        amount,
        category,
        expense_date,
        payment_method,
        receipt_number,
        vendor,
        created_at,
        created_by
      FROM expenses
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (startDate && endDate) {
      query += ` AND expense_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else if (days && !startDate) {
      const daysInt = parseInt(days) || 30;
      query += ` AND expense_date >= CURRENT_DATE - INTERVAL '${daysInt} days'`;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` ORDER BY expense_date DESC, created_at DESC LIMIT 1000`;
    
    const { rows } = await pool.query(query, params);
    
    // Get summary by category
    const categorySummary = await pool.query(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE 1=1
      ${startDate && endDate ? `AND expense_date BETWEEN $1 AND $2` : days && !startDate ? `AND expense_date >= CURRENT_DATE - INTERVAL '${parseInt(days) || 30} days'` : ''}
      ${category ? `AND category = $${startDate && endDate ? 3 : 1}` : ''}
      GROUP BY category
      ORDER BY total DESC
    `, params);
    
    // Get monthly total
    const monthlyTotal = await pool.query(`
      SELECT 
        DATE_TRUNC('month', expense_date) as month,
        SUM(amount) as total
      FROM expenses
      WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY DATE_TRUNC('month', expense_date)
    `);
    
    return res.json({
      expenses: rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        amount: parseFloat(r.amount || 0),
        category: r.category,
        expenseDate: r.expense_date,
        paymentMethod: r.payment_method,
        receiptNumber: r.receipt_number,
        vendor: r.vendor,
        createdAt: r.created_at,
        createdBy: r.created_by || "SYSTEM",
      })),
      byCategory: categorySummary.rows.map(r => ({
        category: r.category,
        count: parseInt(r.count || 0),
        total: parseFloat(r.total || 0),
      })),
      monthlyTotal: monthlyTotal.rows.length > 0 ? parseFloat(monthlyTotal.rows[0].total || 0) : 0,
    });
  } catch (err) {
    console.error("Error fetching expenses reports:", err);
    return res.status(500).json({ message: "Failed to fetch expenses reports" });
  }
});

// Backup stub
router.post("/backup", auth, authorize("ADMIN"), async (_req, res) => {
  // In production, run pg_dump and stream file; here we just acknowledge.
  return res.json({ message: "Backup triggered (stub)" });
});

// Restore stub
router.post(
  "/restore",
  auth,
  authorize("ADMIN"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Backup file is required" });
    }
    // In production, feed file buffer to psql; here we just acknowledge.
    return res.json({ message: "Restore received (stub)" });
  }
);

export default router;

