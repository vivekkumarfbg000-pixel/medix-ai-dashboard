-- Fix for N8N "Save Expiry Notification" node error
-- The workflow might be sending 'expiry_alert' or similar which fails the check constraint.
-- We will expand the allowed types to be more flexible.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'expiry', 'stock', 'system', 'reminder', 
    'expiry_alert', 'stock_alert', 'danger', 'info', 'success'
));
