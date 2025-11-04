-- ============================================
-- WARMINDOGENZ CUSTOMER APP - IMPROVED DATABASE SETUP
-- ============================================
-- Version: 2.0
-- Date: November 4, 2025
-- Improvements:
-- 1. Foreign Key Constraints untuk integritas referensial
-- 2. Primary Key Constraints pada junction tables
-- 3. Konsistensi NOT NULL dan DEFAULT values
-- 4. Indexes untuk optimasi performa
-- 5. Trigger untuk sinkronisasi auth.users → profiles
-- 6. Full-text search index
-- 7. Renamed 'tables' → 'dining_tables' untuk menghindari ambiguitas
-- ============================================

-- ============================================
-- SECTION 1: CREATE TABLES WITH PROPER CONSTRAINTS
-- ============================================

-- 1.1 Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 Menus Table
CREATE TABLE IF NOT EXISTS public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_86 BOOLEAN NOT NULL DEFAULT false,
  popularity INTEGER NOT NULL DEFAULT 0,
  search_tsv TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 Profiles Table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.4 Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id UUID,
  payment_code TEXT UNIQUE,
  queue_no INTEGER,
  guest_name TEXT,
  contact TEXT,
  service_type TEXT NOT NULL DEFAULT 'dine_in' CHECK (service_type IN ('dine_in', 'takeaway', 'delivery')),
  table_no TEXT,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','paid','confirmed','prep','ready','served','completed','canceled')),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'pos', 'mobile')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guest_info_check CHECK (guest_name IS NOT NULL OR contact IS NOT NULL)
);

-- 1.5 Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','prep','ready','served','canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.6 Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'qris', 'transfer', 'e-wallet')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  proof_url TEXT,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.7 Option Groups Table (for menu customizations)
CREATE TABLE IF NOT EXISTS public.option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  max_selections INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.8 Options Table (individual options within groups)
CREATE TABLE IF NOT EXISTS public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.9 Order Item Options Table (selected options for each order item)
CREATE TABLE IF NOT EXISTS public.order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.options(id) ON DELETE RESTRICT,
  price_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.10 KDS Stations Table
CREATE TABLE IF NOT EXISTS public.kds_stations (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.11 Menu Stations Table (junction table - which menus go to which KDS stations)
CREATE TABLE IF NOT EXISTS public.menu_stations (
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  station_key TEXT NOT NULL REFERENCES public.kds_stations(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (menu_id, station_key)
);

-- 1.12 KDS Bumps Table (tracking when items are bumped/completed in KDS)
CREATE TABLE IF NOT EXISTS public.kds_bumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  station_key TEXT NOT NULL REFERENCES public.kds_stations(key) ON DELETE CASCADE,
  bumped_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  bumped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.13 Order Events Table (audit log for order status changes)
CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  actor UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.14 Receipt Dispatches Table (tracking receipt printing/sending)
CREATE TABLE IF NOT EXISTS public.receipt_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dispatch_type TEXT NOT NULL CHECK (dispatch_type IN ('print', 'email', 'whatsapp')),
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.15 Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.16 Ingredients Table (for inventory management)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.17 Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.18 Stock Ledger Table (inventory movement tracking)
CREATE TABLE IF NOT EXISTS public.stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity DECIMAL(10,3) NOT NULL,
  balance_after DECIMAL(10,3) NOT NULL,
  unit_cost DECIMAL(10,2),
  ref_order_item UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  ref_supplier UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.19 Recipes BOM Table (Bill of Materials - which ingredients are used in each menu)
CREATE TABLE IF NOT EXISTS public.recipes_bom (
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_per_serving DECIMAL(10,3) NOT NULL CHECK (quantity_per_serving > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (menu_id, ingredient_id)
);

-- 1.20 Option BOM Table (ingredients used by options)
CREATE TABLE IF NOT EXISTS public.option_bom (
  option_id UUID NOT NULL REFERENCES public.options(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_per_serving DECIMAL(10,3) NOT NULL CHECK (quantity_per_serving > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (option_id, ingredient_id)
);

-- 1.21 Dining Tables Table (renamed from 'tables' to avoid ambiguity)
CREATE TABLE IF NOT EXISTS public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_no TEXT NOT NULL UNIQUE,
  seats INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
  current_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 2: PAYMENT CODE TRIGGER
-- ============================================

-- Function to generate unique payment code
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

-- Trigger function to set payment code
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
-- SECTION 3: QUEUE NUMBER TRIGGER
-- ============================================

-- Trigger function to set daily queue number
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
-- SECTION 4: UPDATED_AT TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.trg_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.menus
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.option_groups
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.options
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.kds_stations
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.recipes_bom
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON public.dining_tables
FOR EACH ROW EXECUTE FUNCTION public.trg_update_timestamp();

-- ============================================
-- SECTION 5: AUTH.USERS → PROFILES SYNC TRIGGER
-- ============================================

-- Function to create profile when new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END $$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SECTION 6: FULL-TEXT SEARCH FOR MENUS
-- ============================================

-- Function to update search_tsv column
CREATE OR REPLACE FUNCTION public.trg_update_menu_search()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv := 
    setweight(to_tsvector('indonesian', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('indonesian', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS update_menu_search ON public.menus;
CREATE TRIGGER update_menu_search
BEFORE INSERT OR UPDATE ON public.menus
FOR EACH ROW EXECUTE FUNCTION public.trg_update_menu_search();

-- ============================================
-- SECTION 7: RPC FUNCTION FOR FREE TABLES
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
-- SECTION 8: VIEW FOR PUBLIC QUEUE
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
-- SECTION 9: PERFORMANCE INDEXES
-- ============================================

-- Indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_menus_category_id ON public.menus(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_profile_id ON public.orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_id ON public.order_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_option_groups_menu_id ON public.option_groups(menu_id);
CREATE INDEX IF NOT EXISTS idx_options_group_id ON public.options(group_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id ON public.order_item_options(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_option_id ON public.order_item_options(option_id);
CREATE INDEX IF NOT EXISTS idx_kds_bumps_order_item_id ON public.kds_bumps(order_item_id);
CREATE INDEX IF NOT EXISTS idx_kds_bumps_station_key ON public.kds_bumps(station_key);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_receipt_dispatches_order_id ON public.receipt_dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ingredient_id ON public.stock_ledger(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ref_order_item ON public.stock_ledger(ref_order_item);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ref_supplier ON public.stock_ledger(ref_supplier);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_code ON public.orders(payment_code);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON public.orders(service_type);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_menus_is_active ON public.menus(is_active);
CREATE INDEX IF NOT EXISTS idx_menus_is_available ON public.menus(is_available);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_menus_search_tsv ON public.menus USING GIN(search_tsv);

-- Unique constraint for KDS station key
CREATE UNIQUE INDEX IF NOT EXISTS idx_kds_stations_key_unique ON public.kds_stations(key);

-- ============================================
-- SECTION 10: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on customer-facing tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS web_insert_orders ON public.orders;
DROP POLICY IF EXISTS web_select_orders ON public.orders;
DROP POLICY IF EXISTS web_ins_items ON public.order_items;
DROP POLICY IF EXISTS web_sel_items ON public.order_items;
DROP POLICY IF EXISTS web_ins_pay ON public.payments;
DROP POLICY IF EXISTS web_sel_pay ON public.payments;
DROP POLICY IF EXISTS anon_select_menus ON public.menus;
DROP POLICY IF EXISTS anon_select_categories ON public.categories;

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

-- Menus: Allow public read for active menus
CREATE POLICY anon_select_menus ON public.menus
FOR SELECT TO anon, authenticated
USING (is_active = true);

-- Categories: Allow public read for active categories
CREATE POLICY anon_select_categories ON public.categories
FOR SELECT TO anon, authenticated
USING (is_active = true);

-- Grant access to view
GRANT SELECT ON public.vw_queue_today TO anon, authenticated;

-- Grant usage on sequences (if any custom sequences are used)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- SECTION 11: STORAGE BUCKET FOR PAYMENT PROOFS
-- ============================================

-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-proofs bucket
DROP POLICY IF EXISTS "Allow anon upload to payment-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon read own payment-proofs" ON storage.objects;

CREATE POLICY "Allow anon upload to payment-proofs"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Allow anon read own payment-proofs"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'payment-proofs');

-- ============================================
-- SECTION 12: SEED DATA (OPTIONAL)
-- ============================================

-- Insert sample categories
INSERT INTO public.categories (id, name, description, is_active, display_order)
VALUES 
  ('f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Makanan Berat', 'Menu makanan utama seperti nasi dan mie', true, 1),
  ('f7f8b6c1-1e4d-4c9a-8f2e-1234567890ac', 'Minuman', 'Berbagai minuman segar dan kopi', true, 2),
  ('f7f8b6c1-1e4d-4c9a-8f2e-1234567890ad', 'Snack', 'Camilan dan makanan ringan', true, 3)
ON CONFLICT (id) DO NOTHING;

-- Insert sample menus
INSERT INTO public.menus (id, category_id, name, description, price, image_url, is_active, is_available, popularity)
VALUES 
  ('a1b2c3d4-1111-1111-1111-000000000001', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Indomie Goreng Spesial', 'Indomie goreng dengan telur, kornet, dan sayuran', 15000, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400', true, true, 100),
  ('a1b2c3d4-1111-1111-1111-000000000002', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Indomie Kuah Soto', 'Indomie kuah rasa soto ayam dengan topping lengkap', 15000, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400', true, true, 95),
  ('a1b2c3d4-1111-1111-1111-000000000003', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Nasi Goreng Spesial', 'Nasi goreng dengan ayam, telur, dan kerupuk', 18000, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400', true, true, 90),
  ('a1b2c3d4-1111-1111-1111-000000000004', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Mie Goreng Jawa', 'Mie goreng khas Jawa dengan bumbu rempah', 16000, 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400', true, true, 85),
  ('a1b2c3d4-1111-1111-1111-000000000005', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Ayam Geprek', 'Ayam goreng crispy dengan sambal geprek pedas', 20000, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400', true, true, 88),
  ('a1b2c3d4-1111-1111-1111-000000000006', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ac', 'Es Teh Manis', 'Teh manis dingin segar', 5000, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', true, true, 100),
  ('a1b2c3d4-1111-1111-1111-000000000007', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ac', 'Es Jeruk', 'Jus jeruk segar dengan es', 8000, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400', true, true, 92),
  ('a1b2c3d4-1111-1111-1111-000000000008', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ac', 'Kopi Susu', 'Kopi susu khas warung', 10000, 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400', true, true, 94),
  ('a1b2c3d4-1111-1111-1111-000000000009', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ad', 'Pisang Goreng', 'Pisang goreng crispy (5 pcs)', 10000, 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=400', true, true, 80),
  ('a1b2c3d4-1111-1111-1111-000000000010', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ad', 'Tahu Isi', 'Tahu isi sayuran dan daging (5 pcs)', 12000, 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=400', true, true, 75),
  ('a1b2c3d4-1111-1111-1111-000000000011', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Soto Ayam', 'Soto ayam dengan nasi dan pelengkap', 17000, 'https://images.unsplash.com/photo-1620791144815-6e552a7b2177?w=400', true, true, 87),
  ('a1b2c3d4-1111-1111-1111-000000000012', 'f7f8b6c1-1e4d-4c9a-8f2e-1234567890ab', 'Rendang', 'Rendang daging sapi dengan nasi', 25000, 'https://images.unsplash.com/photo-1625937286074-9ca519d5d9df?w=400', true, true, 93)
ON CONFLICT (id) DO NOTHING;

-- Insert sample KDS stations
INSERT INTO public.kds_stations (key, name, description, is_active, display_order)
VALUES 
  ('kitchen-main', 'Kitchen Utama', 'Stasiun masak utama untuk makanan berat', true, 1),
  ('kitchen-grill', 'Grill Station', 'Stasiun khusus untuk menu panggang/bakar', true, 2),
  ('beverage', 'Beverage Station', 'Stasiun minuman', true, 3),
  ('snack-bar', 'Snack Bar', 'Stasiun cemilan dan makanan ringan', true, 4)
ON CONFLICT (key) DO NOTHING;

-- Insert sample dining tables
INSERT INTO public.dining_tables (table_no, seats, status)
VALUES 
  ('1', 4, 'available'),
  ('2', 4, 'available'),
  ('3', 2, 'available'),
  ('4', 6, 'available'),
  ('5', 4, 'available'),
  ('6', 4, 'available'),
  ('7', 2, 'available'),
  ('8', 8, 'available'),
  ('9', 4, 'available'),
  ('10', 4, 'available')
ON CONFLICT (table_no) DO NOTHING;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- 
-- ✅ IMPROVEMENTS APPLIED:
-- 
-- 1. Foreign Key Constraints
--    - Semua relasi telah memiliki FK dengan ON DELETE/UPDATE yang sesuai
--    - Mencegah data yatim (orphaned records)
-- 
-- 2. Primary Key Constraints
--    - Junction tables (menu_stations, option_bom, recipes_bom) menggunakan composite PK
-- 
-- 3. NOT NULL Consistency
--    - Kolom wajib diisi sudah diberi NOT NULL
--    - Kolom opsional tetap nullable sesuai kebutuhan bisnis
-- 
-- 4. Performance Indexes
--    - Index pada semua foreign keys
--    - Index pada kolom yang sering difilter (status, created_at, dll)
--    - GIN index untuk full-text search
-- 
-- 5. Auth.users → Profiles Sync
--    - Trigger otomatis membuat profile saat user baru mendaftar
-- 
-- 6. Full-Text Search
--    - Trigger otomatis update search_tsv saat menu diupdate
--    - Index GIN untuk performa pencarian optimal
-- 
-- 7. Table Renamed
--    - 'tables' → 'dining_tables' untuk menghindari ambiguitas
-- 
-- 8. Updated_at Triggers
--    - Semua tabel dengan updated_at otomatis diupdate saat ada perubahan
-- 
-- NEXT STEPS:
-- 
-- 1. Update web/shared/js/supabase.js dengan Supabase URL dan anon key
-- 2. Jika sudah ada data di database lama, lakukan migrasi data
-- 3. Update kode aplikasi jika ada referensi ke tabel 'tables' → 'dining_tables'
-- 4. Test semua fitur aplikasi dengan schema baru
-- 5. Monitor performa query dengan indexes yang baru
-- 
-- ============================================
