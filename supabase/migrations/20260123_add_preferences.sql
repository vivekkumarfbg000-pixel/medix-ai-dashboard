-- Add preferences column to shop_settings for storing UI toggles (notifications, theme, etc.)
ALTER TABLE public.shop_settings 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
