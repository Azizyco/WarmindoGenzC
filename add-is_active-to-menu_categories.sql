-- ============================================
-- OPTIONAL: Add is_active column to menu_categories
-- ============================================
-- Run this SQL if you want to enable/disable categories dynamically

-- Add is_active column
ALTER TABLE public.menu_categories
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.menu_categories.is_active IS 'Whether this category is currently active and visible to customers';

-- Optional: Create index for performance (if you'll filter by is_active frequently)
CREATE INDEX IF NOT EXISTS idx_menu_categories_is_active 
ON public.menu_categories(is_active);

-- ============================================
-- After running this SQL, update menu.js:
-- ============================================
-- Uncomment this line in menu.js (around line 50):
-- .eq('is_active', true)
-- 
-- The query will look like:
-- const { data: cats, error: catsError } = await supabase
--   .from('menu_categories')
--   .select('*')
--   .eq('is_active', true)  // <-- Uncomment this
--   .order('name');
