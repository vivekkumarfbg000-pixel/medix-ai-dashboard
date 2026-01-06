-- Migration to support removal of all demo/mock data
-- Add missing columns and tables for production readiness
-- Created: 2026-01-06

-- 1. Add license_expiry to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS license_expiry TIMESTAMP WITH TIME ZONE;

-- Set default value for existing shops (1 year from now)
UPDATE shops 
SET license_expiry = NOW() + INTERVAL '1 year' 
WHERE license_expiry IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN shops.license_expiry IS 'Pharmacy license expiration date for compliance tracking';

-- 2. Create notifications table for alerts system
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_shop_id ON notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view notifications for their shop" ON notifications;
CREATE POLICY "Users can view notifications for their shop"
ON notifications FOR SELECT
USING (
    shop_id IN (
        SELECT shop_id FROM profiles WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update notifications for their shop" ON notifications;
CREATE POLICY "Users can update notifications for their shop"
ON notifications FOR UPDATE
USING (
    shop_id IN (
        SELECT shop_id FROM profiles WHERE id = auth.uid()
    )
);

-- 3. Create forecast_history table for AI forecasting
CREATE TABLE IF NOT EXISTS forecast_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    forecasted_demand INTEGER NOT NULL,
    actual_sales INTEGER,
    forecast_date DATE NOT NULL,
    period TEXT DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    algorithm TEXT DEFAULT 'moving_average',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_forecast_history_shop_id ON forecast_history(shop_id);
CREATE INDEX IF NOT EXISTS idx_forecast_history_forecast_date ON forecast_history(forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_history_medicine_name ON forecast_history(medicine_name);

-- Enable RLS
ALTER TABLE forecast_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forecast_history
DROP POLICY IF EXISTS "Users can view forecast history for their shop" ON forecast_history;
CREATE POLICY "Users can view forecast history for their shop"
ON forecast_history FOR SELECT
USING (
    shop_id IN (
        SELECT shop_id FROM profiles WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "System can manage forecast history" ON forecast_history;
CREATE POLICY "System can manage forecast history"
ON forecast_history FOR ALL
USING (
    shop_id IN (
        SELECT shop_id FROM profiles WHERE id = auth.uid()
    )
);

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'System notifications and alerts for shops';
COMMENT ON TABLE forecast_history IS 'Historical records of AI-generated inventory forecasts';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for notifications updated_at
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
