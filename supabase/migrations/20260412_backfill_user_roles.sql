-- =============================================================================
-- BACKFILL user_roles + VERIFY user_shops (2026-04-12)
-- =============================================================================
-- Context:
--   useUserRole.ts was querying user_shops.role (column doesn't exist).
--   It now correctly queries user_roles.role.
--   This migration ensures every shop owner has exactly one row in user_roles.
--
-- Safe to run multiple times (idempotent via ON CONFLICT DO NOTHING).
-- =============================================================================

-- STEP 1: Backfill user_roles from user_shops + profiles 
-- -----------------------------------------------------------------------------
-- For every user who owns a shop (in user_shops) but has no role row,
-- create an 'admin' role row so they can modify inventory.
INSERT INTO public.user_roles (user_id, shop_id, role)
SELECT 
    us.user_id,
    us.shop_id,
    'admin'::public.app_role
FROM public.user_shops us
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = us.user_id 
      AND ur.shop_id = us.shop_id
)
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- STEP 2: Backfill user_shops for any profiles still missing it
-- -----------------------------------------------------------------------------
INSERT INTO public.user_shops (user_id, shop_id, is_primary)
SELECT
    p.user_id,
    p.shop_id,
    true
FROM public.profiles p
WHERE
    p.shop_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public.user_shops us
        WHERE us.user_id = p.user_id
    )
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- STEP 3: Update handle_new_user trigger to also create user_roles on signup
-- -----------------------------------------------------------------------------
-- (Already handled by the latest trigger in 20260412_fix_shop_sync_backfill.sql)

-- VERIFICATION QUERIES (uncomment to run manually):
-- ─────────────────────────────────────────────────
-- Check if current user has user_shops row:
-- SELECT us.user_id, us.shop_id, us.is_primary, s.name
-- FROM user_shops us JOIN shops s ON s.id = us.shop_id
-- WHERE us.user_id = auth.uid();

-- Check if current user has user_roles row:
-- SELECT ur.user_id, ur.shop_id, ur.role, s.name
-- FROM user_roles ur JOIN shops s ON s.id = ur.shop_id
-- WHERE ur.user_id = auth.uid();
