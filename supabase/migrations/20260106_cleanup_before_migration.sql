-- Cleanup script: Remove all partially created tables from failed migration attempts
-- Run this BEFORE running the main migration

-- Drop notifications table and related objects
DROP TABLE IF EXISTS notifications CASCADE;
DROP INDEX IF EXISTS idx_notifications_shop_id;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_read;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

-- Drop forecast_history table and related objects  
DROP TABLE IF EXISTS forecast_history CASCADE;
DROP INDEX IF EXISTS idx_forecast_history_shop_id;
DROP INDEX IF EXISTS idx_forecast_history_forecast_date;
DROP INDEX IF EXISTS idx_forecast_history_medicine_name;

-- Drop the trigger function if it exists (will be recreated by migration)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Remove license_expiry column from shops if it was partially added
-- (Comment this out if you want to keep existing license data)
-- ALTER TABLE shops DROP COLUMN IF EXISTS license_expiry;

-- Now you can run the main migration file: 20260106_remove_demo_data.sql
