# Quick Fix for Inventory 500 Error

## The Problem
You're getting a 500 error because the database doesn't have the required columns for the inventory system.

## The Solution (2 Steps)

### Step 1: Run the Migration
Open a terminal in the **backend** folder and run:

```bash
npm run migrate:inventory
```

This will automatically:
- Create the `inventory_items` table if it doesn't exist
- Add all required columns (quantity, unit, expire_date, etc.)
- Set up the proper schema

### Step 2: Restart Your Backend Server
After the migration completes successfully, restart your backend:

```bash
npm start
```

## That's It!
The inventory system should now work correctly. You can:
- Add inventory items
- Track quantities in grams/kilograms
- Set expire dates
- Configure low stock alerts

## Alternative: Manual Migration
If the npm script doesn't work, you can run the SQL file manually:

1. Connect to your PostgreSQL database
2. Run the SQL commands from: `backend/db/migrations/002_add_missing_inventory_columns.sql`


