import express from "express";
import auth from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import pool from "../db.js";

const router = express.Router();

// Get all expenses with optional filters
router.get("/", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { category, startDate, endDate, limit = 100 } = req.query;
    
    let query = `
      SELECT id, title, description, amount, category, expense_date, 
             payment_method, receipt_number, vendor, created_at, created_by, updated_at
      FROM expenses
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (startDate) {
      paramCount++;
      query += ` AND expense_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND expense_date <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY expense_date DESC, created_at DESC LIMIT $${++paramCount}`;
    params.push(parseInt(limit));

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    return res.status(500).json({ message: "Could not fetch expenses" });
  }
});

// Get expense by ID
router.get("/:id", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM expenses WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching expense:", err);
    return res.status(500).json({ message: "Could not fetch expense" });
  }
});

// Create new expense
router.post("/", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const {
      title,
      description,
      amount,
      category,
      expense_date,
      payment_method = "CASH",
      receipt_number,
      vendor,
    } = req.body;

    if (!title || !amount || !category) {
      return res.status(400).json({ message: "Title, amount, and category are required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO expenses 
       (title, description, amount, category, expense_date, payment_method, receipt_number, vendor, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        description || null,
        amount,
        category,
        expense_date || new Date().toISOString().split("T")[0],
        payment_method,
        receipt_number || null,
        vendor || null,
        req.user?.username || "SYSTEM",
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating expense:", err);
    return res.status(500).json({ message: "Could not create expense" });
  }
});

// Update expense
router.put("/:id", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const {
      title,
      description,
      amount,
      category,
      expense_date,
      payment_method,
      receipt_number,
      vendor,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE expenses 
       SET title = $1, description = $2, amount = $3, category = $4, 
           expense_date = $5, payment_method = $6, receipt_number = $7, 
           vendor = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title,
        description || null,
        amount,
        category,
        expense_date,
        payment_method,
        receipt_number || null,
        vendor || null,
        req.params.id,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Error updating expense:", err);
    return res.status(500).json({ message: "Could not update expense" });
  }
});

// Delete expense
router.delete("/:id", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM expenses WHERE id = $1", [
      req.params.id,
    ]);

    if (rowCount === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    return res.status(500).json({ message: "Could not delete expense" });
  }
});

// Get expense statistics (for dashboard)
router.get("/stats/summary", auth, authorize("ADMIN"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = "";
    const params = [];
    if (startDate && endDate) {
      dateFilter = "WHERE expense_date BETWEEN $1 AND $2";
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = "WHERE expense_date >= $1";
      params.push(startDate);
    } else if (endDate) {
      dateFilter = "WHERE expense_date <= $1";
      params.push(endDate);
    }

    // Total expenses
    const totalQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${dateFilter}`;
    const totalResult = await pool.query(totalQuery, params);

    // Expenses by category
    const categoryQuery = `
      SELECT category, COALESCE(SUM(amount), 0) as total
      FROM expenses
      ${dateFilter}
      GROUP BY category
      ORDER BY total DESC
    `;
    const categoryResult = await pool.query(categoryQuery, params);

    // Today's expenses
    const todayQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date = CURRENT_DATE
    `;
    const todayResult = await pool.query(todayQuery);

    // This month's expenses
    const monthQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
    `;
    const monthResult = await pool.query(monthQuery);

    return res.json({
      total: parseFloat(totalResult.rows[0].total),
      today: parseFloat(todayResult.rows[0].total),
      thisMonth: parseFloat(monthResult.rows[0].total),
      byCategory: categoryResult.rows,
    });
  } catch (err) {
    console.error("Error fetching expense stats:", err);
    return res.status(500).json({ message: "Could not fetch expense statistics" });
  }
});

export default router;

