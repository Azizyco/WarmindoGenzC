-- ============================================
-- Supabase Storage Setup for Menu Images
-- ============================================

-- 1. Create storage bucket 'menu-images' (PUBLIC)
-- Run this in Supabase SQL Editor or create via Dashboard > Storage

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true, -- Public bucket (images accessible via URL)
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Storage policies for menu-images bucket

-- Allow anonymous users to READ images (public access)
CREATE POLICY "Public Access for Menu Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');

-- Allow authenticated users to UPLOAD images (for admin/staff)
CREATE POLICY "Authenticated Upload for Menu Images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

-- Allow authenticated users to UPDATE their uploads
CREATE POLICY "Authenticated Update for Menu Images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-images');

-- Allow authenticated users to DELETE images
CREATE POLICY "Authenticated Delete for Menu Images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');

-- ============================================
-- 3. Add image_path column to menus table
-- ============================================

-- Add column to store relative path in storage
ALTER TABLE public.menus
ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN public.menus.image_path 
IS 'Relative path to image file in menu-images storage bucket (e.g., "indomie-goreng.jpg" or "foods/indomie-goreng.jpg")';

-- Optional: Keep image_url for backward compatibility or external images
-- ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================
-- 4. Migration: Convert existing image_url to image_path (OPTIONAL)
-- ============================================

-- If you have existing menus with image_url pointing to external URLs,
-- you'll need to:
-- 1. Download those images
-- 2. Upload to Supabase Storage bucket 'menu-images'
-- 3. Update image_path with the new storage path

-- Example update after uploading images:
-- UPDATE public.menus SET image_path = 'indomie-goreng.jpg' WHERE id = 'menu-001';
-- UPDATE public.menus SET image_path = 'nasi-goreng.jpg' WHERE id = 'menu-002';

-- ============================================
-- 5. Upload Images via Supabase Dashboard
-- ============================================

-- Method 1: Via Dashboard (Easiest)
-- 1. Go to Supabase Dashboard > Storage > menu-images
-- 2. Click "Upload file"
-- 3. Select your menu images
-- 4. Copy the path (e.g., "indomie-goreng.jpg")
-- 5. Update menus table with that path

-- Method 2: Via JavaScript (Programmatic)
-- const file = event.target.files[0];
-- const { data, error } = await supabase.storage
--   .from('menu-images')
--   .upload('indomie-goreng.jpg', file);
-- 
-- if (!error) {
--   await supabase.from('menus')
--     .update({ image_path: data.path })
--     .eq('id', menuId);
-- }

-- ============================================
-- 6. Sample Data Update
-- ============================================

-- Update existing menus with sample image paths
-- (Assuming you've uploaded images with these names)

UPDATE public.menus SET image_path = 'indomie-goreng.jpg' 
WHERE name ILIKE '%indomie goreng%';

UPDATE public.menus SET image_path = 'nasi-goreng.jpg' 
WHERE name ILIKE '%nasi goreng%';

UPDATE public.menus SET image_path = 'ayam-geprek.jpg' 
WHERE name ILIKE '%ayam geprek%';

UPDATE public.menus SET image_path = 'es-teh.jpg' 
WHERE name ILIKE '%es teh%';

UPDATE public.menus SET image_path = 'kopi-susu.jpg' 
WHERE name ILIKE '%kopi%';

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- 
-- Your menu images are now:
-- 1. ✅ Stored in Supabase Storage (fast CDN)
-- 2. ✅ Publicly accessible via URL
-- 3. ✅ Automatically handled by menu.js
-- 4. ✅ Fallback to /assets/no-image.png if missing
-- 
-- Image URL format:
-- https://<project-id>.supabase.co/storage/v1/object/public/menu-images/<image_path>
-- 
-- Example:
-- https://caheywvfmftksrjgdkjr.supabase.co/storage/v1/object/public/menu-images/indomie-goreng.jpg
