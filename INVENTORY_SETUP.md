# Inventory System Setup Instructions

## Fix Database Schema Error

The error "column 'quantity' does not exist" means your database table doesn't have the required columns. Follow these steps:

### Step 1: Run the Migration Script

Run this SQL script on your PostgreSQL database to add the missing columns:

**File: `backend/db/migrations/002_add_missing_inventory_columns.sql`**

You can run it using:
```bash
psql -U your_username -d your_database_name -f backend/db/migrations/002_add_missing_inventory_columns.sql
```

Or if you're using a connection string, connect to your database and run the SQL commands from the file.

### Step 2: Restart Your Backend Server

After running the migration, restart your backend server:
```bash
cd backend
npm start
```

### Step 3: Verify It Works

1. Navigate to the Inventory page in your frontend
2. Try adding a new inventory item
3. The system should now work correctly

## What Was Fixed

1. ✅ Removed unnecessary fields: barcode, supplier, location, notes
2. ✅ Simplified the inventory form to only essential fields:
   - Name (required)
   - Quantity (required)
   - Unit (grams, kilograms, pieces, liters, ml)
   - Expire Date (optional)
   - Low Stock Threshold (optional)
   - Category (optional)
   - Cost per Unit (optional)
3. ✅ Fixed database schema to match the code
4. ✅ Added migration script to update existing databases

## Required Fields for Inventory Items

- **Name**: Item name (e.g., "Chicken Breast")
- **Quantity**: Current stock quantity (e.g., 5.5)
- **Unit**: Measurement unit (grams, kilograms, pieces, liters, ml)

## Optional Fields

- **Expire Date**: When the item expires
- **Low Stock Threshold**: Alert when stock falls below this amount
- **Category**: Item category (e.g., "Meat", "Vegetables")
- **Cost per Unit**: Cost per unit in local currency

The system will automatically:
- Show alerts for expired items
- Warn when stock is low
- Convert between grams and kilograms for display
- Track inventory when orders are placed (if BOM is configured)



