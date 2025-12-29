import express from "express";
import auth from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import pool from "../db.js";

const router = express.Router();

// POS order creation (both ADMIN and CASHIER)
router.post("/", auth, authorize("ADMIN", "CASHIER"), async (req, res) => {
  const { total, payment_method: paymentMethod, items = [] } = req.body;
  if (!total || !paymentMethod || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ message: "Total, payment method, and items are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderResult = await client.query(
      "INSERT INTO orders (total, payment_method) VALUES ($1, $2) RETURNING id",
      [total, paymentMethod]
    );
    const orderId = orderResult.rows[0].id;

    const insertItems = items.map((item) =>
      client.query(
        "INSERT INTO order_items (order_id, product_id, qty, price) VALUES ($1, $2, $3, $4)",
        [orderId, item.product_id, item.qty, item.price]
      )
    );
    await Promise.all(insertItems);

    // Deduct inventory based on product-inventory mappings (Bill of Materials)
    for (const item of items) {
      // Get inventory requirements for this product
      const bomResult = await client.query(
        `SELECT pi.inventory_item_id, pi.quantity_required, pi.unit, 
                ii.quantity as current_quantity, ii.unit as inventory_unit
         FROM product_inventory pi
         JOIN inventory_items ii ON pi.inventory_item_id = ii.id
         WHERE pi.product_id = $1`,
        [item.product_id]
      );

      for (const bom of bomResult.rows) {
        // Calculate total quantity needed (quantity_required * order_qty)
        let qtyNeeded = parseFloat(bom.quantity_required) * item.qty;
        const requiredUnit = bom.unit;
        const inventoryUnit = bom.inventory_unit;

        // Convert units if necessary (e.g., kg to grams)
        if (requiredUnit !== inventoryUnit) {
          if (requiredUnit === "grams" && inventoryUnit === "kilograms") {
            qtyNeeded = qtyNeeded / 1000; // Convert grams to kg
          } else if (requiredUnit === "kilograms" && inventoryUnit === "grams") {
            qtyNeeded = qtyNeeded * 1000; // Convert kg to grams
          } else if (requiredUnit === "ml" && inventoryUnit === "liters") {
            qtyNeeded = qtyNeeded / 1000; // Convert ml to liters
          } else if (requiredUnit === "liters" && inventoryUnit === "ml") {
            qtyNeeded = qtyNeeded * 1000; // Convert liters to ml
          }
          // For pieces or same units, no conversion needed
        }

        const currentQty = parseFloat(bom.current_quantity);

        // Check if enough inventory
        if (currentQty < qtyNeeded) {
          // Not enough stock, but we'll still deduct what we have (or you could reject the order)
          console.warn(`Insufficient inventory for item ${bom.inventory_item_id}. Required: ${qtyNeeded}, Available: ${currentQty}`);
          qtyNeeded = currentQty; // Deduct only what's available
        }

        if (qtyNeeded > 0) {
          // Deduct inventory
          await client.query(
            `UPDATE inventory_items 
             SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
             WHERE id = $2`,
            [qtyNeeded, bom.inventory_item_id]
          );

          // Log transaction (if table exists)
          try {
            await client.query(
              `INSERT INTO inventory_transactions 
               (inventory_item_id, transaction_type, quantity, unit, reference_id, reference_type, notes, created_by)
               VALUES ($1, 'SALE', $2, $3, $4, 'ORDER', $5, $6)`,
              [
                bom.inventory_item_id,
                qtyNeeded,
                inventoryUnit,
                orderId,
                `Order #${orderId} - Product ID: ${item.product_id}`,
                req.user?.username || "SYSTEM",
              ]
            );
          } catch (txErr) {
            // Transaction table might not exist, that's okay - inventory was still deducted
            console.warn("Could not log inventory transaction:", txErr.message);
          }
        }
      }
    }

    await client.query("COMMIT");
    return res.status(201).json({ id: orderId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Order creation error:", err);
    return res.status(500).json({ message: "Could not create order" });
  } finally {
    client.release();
  }
});

export default router;
