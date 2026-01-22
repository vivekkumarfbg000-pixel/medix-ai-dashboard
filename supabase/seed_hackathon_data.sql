-- ==========================================
-- MEDIXAI HACKATHON DEMO DATA SEED
-- Run this in Supabase SQL Editor to populate data
-- ==========================================

-- 1. CLEANUP (Optional - Uncomment to reset)
-- DELETE FROM inventory WHERE source = 'demo';
-- DELETE FROM prescriptions WHERE doctor_name LIKE 'Dr. Demo%';

-- GET CURRENT SHOP ID (We try to pick the first one, or use a placeholder)
-- You might need to manually replace this UUID if it fails
DO $$
DECLARE
    target_shop_id uuid;
BEGIN
    SELECT id INTO target_shop_id FROM shops LIMIT 1;
    
    IF target_shop_id IS NULL THEN
        RAISE NOTICE 'No shop found. Creates a demo shop first.';
        RETURN;
    END IF;

    -- 2. INVENTORY (Mix of Good Stock, Expiring, and Low Stock)
    INSERT INTO inventory (shop_id, medicine_name, quantity, unit_price, expiry_date, manufacturer, batch_number, rack_number, source)
    VALUES 
    (target_shop_id, 'Dolo 650mg', 500, 2.00, CURRENT_DATE + INTERVAL '1 year', 'Micro Labs', 'DL2024', 'A1', 'demo'),
    (target_shop_id, 'Pan D Capsules', 45, 12.50, CURRENT_DATE + INTERVAL '6 months', 'Alkem', 'PD092', 'B2', 'demo'),
    (target_shop_id, 'Augmentin 625 Duo', 12, 55.00, CURRENT_DATE + INTERVAL '2 years', 'GSK', 'AG110', 'C1', 'demo'),
    (target_shop_id, 'Azithral 500', 8, 22.00, CURRENT_DATE + INTERVAL '2 months', 'Alembic', 'AZ552', 'C2', 'demo'), -- Low stock
    (target_shop_id, 'Shellcal 500', 200, 8.00, CURRENT_DATE + INTERVAL '18 months', 'Torrent', 'SH881', 'D1', 'demo'),
    (target_shop_id, 'Telma 40', 150, 9.50, CURRENT_DATE + INTERVAL '1 year', 'Glenmark', 'TL404', 'D2', 'demo'),
    (target_shop_id, 'Montair LC', 50, 18.00, CURRENT_DATE - INTERVAL '5 days', 'Cipla', 'EXPIRED', 'X1', 'demo'), -- Expired
    (target_shop_id, 'Zerodol SP', 300, 6.50, CURRENT_DATE + INTERVAL '8 months', 'Ipca', 'ZP332', 'A3', 'demo');

    -- 3. PRESCRIPTIONS (Digital Parchas)
    INSERT INTO prescriptions (shop_id, customer_name, doctor_name, visit_date, medicines, created_at)
    VALUES
    (target_shop_id, 'Rahul Sharma', 'Dr. Demo Gupta', CURRENT_DATE, 
    '[{"name": "Augmentin 625", "dosage": "1-0-1", "days": "5", "indication": "Fever"}, {"name": "Dolo 650", "dosage": "SOS", "days": "3", "indication": "Pain"}]'::jsonb, 
    NOW()),
    (target_shop_id, 'Priya Singh', 'Dr. Demo Verma', CURRENT_DATE - INTERVAL '1 day', 
    '[{"name": "Telma 40", "dosage": "1-0-0", "days": "30", "indication": "BP"}, {"name": "EcoSprint 75", "dosage": "0-0-1", "days": "30", "indication": "Heart"}]'::jsonb, 
    NOW() - INTERVAL '1 day');

    -- 4. SALES HISTORY (For Charts)
    -- We can't easily fake 'orders' table without complex relations, 
    -- but if you have a sales_ledger or similar, populate it here.
    
    RAISE NOTICE 'Hackathon Demo Data Inserted Successfully for Shop ID: %', target_shop_id;
END $$;
