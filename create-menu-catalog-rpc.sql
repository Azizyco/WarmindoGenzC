-- RPC Function untuk mengambil katalog menu (jika belum ada)
-- Digunakan oleh Edge Function chat-rekomendasi

-- Renamed function to menu_catalog (previously get_menu_catalog)
DROP FUNCTION IF EXISTS public.get_menu_catalog(int, boolean, uuid[]); -- cleanup old name if exists
CREATE OR REPLACE FUNCTION public.menu_catalog(
  p_limit int DEFAULT 50,
  p_only_active boolean DEFAULT true,
  p_category_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price int,
  category_id uuid,
  category_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.description,
    m.price,
    m.category_id,
    c.name AS category_name,
    m.is_active
  FROM public.menus m
  LEFT JOIN public.menu_categories c ON c.id = m.category_id
  WHERE (NOT p_only_active OR m.is_active = TRUE)
    AND (p_category_ids IS NULL OR m.category_id = ANY(p_category_ids))
  ORDER BY m.name ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.menu_catalog(int, boolean, uuid[]) TO anon, authenticated;

-- Optional: Create index untuk performance
CREATE INDEX IF NOT EXISTS idx_menus_is_active ON public.menus(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_menus_category_id ON public.menus(category_id) WHERE is_active = true;
