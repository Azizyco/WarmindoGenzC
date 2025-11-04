-- ============================================
-- WARMINDOGENZ CUSTOMER APP - DATABASE SETUP
-- ============================================
-- Run this SQL in Supabase SQL Editor
-- Make sure to run each section in order

-- ============================================
-- 1. PAYMENT CODE COLUMN & TRIGGER
-- ============================================

-- Add payment_code column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_code TEXT UNIQUE;

-- Create function to generate unique payment code
CREATE OR REPLACE FUNCTION public.gen_payment_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code  TEXT;
BEGIN
  LOOP
    code := 'WMG-' ||
      substr(chars, 1+floor(random()*length(chars))::int, 1) ||
      substr(chars, 1+floor(random()*length(chars))::int, 1) ||
      substr(chars, 1+floor(random()*length(chars))::int, 1) ||
      substr(chars, 1+floor(random()*length(chars))::int, 1) ||
      substr(chars, 1+floor(random()*length(chars))::int, 1) ||
      substr(chars, 1+floor(random()*length(chars))::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE payment_code = code);
  END LOOP;
  RETURN code;
END $$;

-- Create trigger function to set payment code
CREATE OR REPLACE FUNCTION public.trg_set_payment_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_code IS NULL THEN
    NEW.payment_code := public.gen_payment_code();
  END IF;
  RETURN NEW;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS set_payment_code ON public.orders;
CREATE TRIGGER set_payment_code
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_payment_code();

-- ============================================
-- 2. QUEUE NUMBER COLUMN & TRIGGER
-- ============================================

-- Add queue_no column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS queue_no INTEGER;

-- Create trigger function to set daily queue number
CREATE OR REPLACE FUNCTION public.trg_set_queue_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  d DATE := (NEW.created_at AT TIME ZONE 'Asia/Jakarta')::DATE;
  next_no INT;
BEGIN
  IF NEW.queue_no IS NOT NULL THEN 
    RETURN NEW; 
  END IF;
  
  SELECT COALESCE(MAX(queue_no), 0) + 1 INTO next_no
  FROM public.orders
  WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::DATE = d;
  
  NEW.queue_no := next_no;
  RETURN NEW;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS set_queue_no ON public.orders;
CREATE TRIGGER set_queue_no
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_queue_no();

-- ============================================
-- 3. RPC FUNCTION FOR FREE TABLES
-- ============================================

CREATE OR REPLACE FUNCTION public.get_free_tables(max_table INT)
RETURNS TABLE(table_no TEXT) LANGUAGE sql STABLE AS $$
  WITH used AS (
    SELECT table_no
    FROM public.orders
    WHERE service_type = 'dine_in'
      AND status IN ('placed','paid','confirmed','prep','ready','served')
      AND table_no IS NOT NULL 
      AND LENGTH(table_no) > 0
  ), all_tables AS (
    SELECT generate_series(1, max_table)::TEXT AS table_no
  )
  SELECT a.table_no
  FROM all_tables a
  LEFT JOIN used u USING (table_no)
  WHERE u.table_no IS NULL
  ORDER BY (a.table_no)::INT;
$$;

-- ============================================
-- 4. VIEW FOR PUBLIC QUEUE
-- ============================================

CREATE OR REPLACE VIEW public.vw_queue_today AS
SELECT
  o.id, 
  o.queue_no,
  o.guest_name, 
  o.contact,
  o.service_type, 
  o.table_no,
  o.status AS order_status,
  (EXISTS (
     SELECT 1 FROM public.payments p
     WHERE p.order_id = o.id AND p.status = 'success'
   )) AS is_paid,
  o.created_at
FROM public.orders o
WHERE (o.created_at AT TIME ZONE 'Asia/Jakarta')::DATE = (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
  AND o.status NOT IN ('completed','canceled')
ORDER BY o.queue_no ASC NULLS LAST, o.created_at ASC;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS web_insert_orders ON public.orders;
DROP POLICY IF EXISTS web_select_orders ON public.orders;
DROP POLICY IF EXISTS web_ins_items ON public.order_items;
DROP POLICY IF EXISTS web_sel_items ON public.order_items;
DROP POLICY IF EXISTS web_ins_pay ON public.payments;
DROP POLICY IF EXISTS web_sel_pay ON public.payments;

-- Orders: Allow insert and select for web source
CREATE POLICY web_insert_orders ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (source = 'web');

CREATE POLICY web_select_orders ON public.orders
FOR SELECT TO anon, authenticated
USING (source = 'web');

-- Order Items: Allow insert and select
CREATE POLICY web_ins_items ON public.order_items
FOR INSERT TO anon, authenticated
WITH CHECK (TRUE);

CREATE POLICY web_sel_items ON public.order_items
FOR SELECT TO anon, authenticated
USING (TRUE);

-- Payments: Allow insert and select
CREATE POLICY web_ins_pay ON public.payments
FOR INSERT TO anon, authenticated
WITH CHECK (TRUE);

CREATE POLICY web_sel_pay ON public.payments
FOR SELECT TO anon, authenticated
USING (TRUE);

-- Grant access to view
GRANT SELECT ON public.vw_queue_today TO anon, authenticated;

-- ============================================
-- 6. STORAGE BUCKET FOR PAYMENT PROOFS
-- ============================================

-- Create bucket (run this in Supabase Dashboard > Storage or via SQL)
-- Go to: https://app.supabase.com/project/_/storage/buckets
-- Create bucket named: payment-proofs
-- Set as PRIVATE

-- Or use SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-proofs bucket
CREATE POLICY "Allow anon upload to payment-proofs"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Allow anon read own payment-proofs"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'payment-proofs');

-- ============================================
-- 7. SEED DATA (OPTIONAL - for testing)
-- ============================================

-- Insert sample categories (if not exists)
INSERT INTO public.categories (id, name, description, is_active)
VALUES 
  ('cat-001', 'Makanan Berat', 'Menu makanan utama', true),
  ('cat-002', 'Minuman', 'Berbagai minuman segar', true),
  ('cat-003', 'Snack', 'Camilan dan makanan ringan', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample menus (if not exists)
INSERT INTO public.menus (id, category_id, name, description, price, image_url, is_active)
VALUES 
  ('menu-001', 'cat-001', 'Indomie Goreng Spesial', 'Indomie goreng dengan telur, kornet, dan sayuran', 15000, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400', true),
  ('menu-002', 'cat-001', 'Indomie Kuah Soto', 'Indomie kuah rasa soto ayam dengan topping lengkap', 15000, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400', true),
  ('menu-003', 'cat-001', 'Nasi Goreng Spesial', 'Nasi goreng dengan ayam, telur, dan kerupuk', 18000, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400', true),
  ('menu-004', 'cat-001', 'Mie Goreng Jawa', 'Mie goreng khas Jawa dengan bumbu rempah', 16000, 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400', true),
  ('menu-005', 'cat-001', 'Ayam Geprek', 'Ayam goreng crispy dengan sambal geprek pedas', 20000, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400', true),
  ('menu-006', 'cat-002', 'Es Teh Manis', 'Teh manis dingin segar', 5000, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', true),
  ('menu-007', 'cat-002', 'Es Jeruk', 'Jus jeruk segar dengan es', 8000, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400', true),
  ('menu-008', 'cat-002', 'Kopi Susu', 'Kopi susu khas warung', 10000, 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400', true),
  ('menu-009', 'cat-003', 'Pisang Goreng', 'Pisang goreng crispy (5 pcs)', 10000, 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=400', true),
  ('menu-010', 'cat-003', 'Tahu Isi', 'Tahu isi sayuran dan daging (5 pcs)', 12000, 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=400', true),
  ('menu-011', 'cat-001', 'Soto Ayam', 'Soto ayam dengan nasi dan pelengkap', 17000, 'https://images.unsplash.com/photo-1620791144815-6e552a7b2177?w=400', true),
  ('menu-012', 'cat-001', 'Rendang', 'Rendang daging sapi dengan nasi', 25000, 'https://images.unsplash.com/photo-1625937286074-9ca519d5d9df?w=400', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Next steps:
-- 1. Update web/shared/js/supabase.js with your Supabase URL and anon key
-- 2. Create the payment-proofs bucket in Supabase Storage (if not created via SQL)
-- 3. Deploy the web folder to your static hosting
-- 4. Test the customer app!
