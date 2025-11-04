# 📊 Database Migration Guide

## Overview

Dokumen ini menjelaskan cara melakukan migrasi dari **database schema lama** (`database-setup.sql`) ke **database schema baru yang ditingkatkan** (`database-setup-improved.sql`).

---

## 🎯 Perbedaan Utama

### 1. **Foreign Key Constraints** ✅
Schema baru menambahkan constraint kunci asing (foreign keys) pada semua relasi antar tabel untuk menjaga integritas data.

**Contoh:**
```sql
-- Lama (tanpa FK):
CREATE TABLE order_items (
  order_id UUID,
  menu_id UUID
);

-- Baru (dengan FK):
CREATE TABLE order_items (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE RESTRICT
);
```

### 2. **Primary Key pada Junction Tables** ✅
Tabel hubungan sekarang memiliki composite primary key.

**Contoh:**
```sql
CREATE TABLE menu_stations (
  menu_id UUID NOT NULL,
  station_key TEXT NOT NULL,
  PRIMARY KEY (menu_id, station_key)
);
```

### 3. **NOT NULL Consistency** ✅
Kolom yang wajib diisi sekarang memiliki constraint `NOT NULL`.

### 4. **Performance Indexes** ✅
Ditambahkan 20+ indexes untuk optimasi performa query.

### 5. **Auto Sync auth.users → profiles** ✅
Trigger otomatis membuat entry di `profiles` saat user baru dibuat.

### 6. **Full-Text Search** ✅
Trigger otomatis update `search_tsv` dan GIN index untuk pencarian menu.

### 7. **Table Renamed** ✅
`tables` → `dining_tables` untuk menghindari ambiguitas dengan keyword SQL.

### 8. **Updated_at Triggers** ✅
Semua tabel dengan `updated_at` otomatis diupdate saat ada perubahan.

---

## 🚀 Strategi Migrasi

### **Opsi A: Fresh Install (Recommended untuk Project Baru)**

Jika Anda **baru memulai** atau **belum ada data penting** di database:

#### Langkah-langkah:

1. **Backup database lama** (jika ada):
   ```sql
   -- Di Supabase SQL Editor, eksport semua data (optional)
   ```

2. **Drop tables lama** (HATI-HATI! Data akan hilang):
   ```sql
   -- Drop dalam urutan terbalik dependency
   DROP TABLE IF EXISTS public.order_item_options CASCADE;
   DROP TABLE IF EXISTS public.order_items CASCADE;
   DROP TABLE IF EXISTS public.payments CASCADE;
   DROP TABLE IF EXISTS public.receipt_dispatches CASCADE;
   DROP TABLE IF EXISTS public.refunds CASCADE;
   DROP TABLE IF EXISTS public.order_events CASCADE;
   DROP TABLE IF EXISTS public.kds_bumps CASCADE;
   DROP TABLE IF EXISTS public.stock_ledger CASCADE;
   DROP TABLE IF EXISTS public.option_bom CASCADE;
   DROP TABLE IF EXISTS public.recipes_bom CASCADE;
   DROP TABLE IF EXISTS public.menu_stations CASCADE;
   DROP TABLE IF EXISTS public.options CASCADE;
   DROP TABLE IF EXISTS public.option_groups CASCADE;
   DROP TABLE IF EXISTS public.orders CASCADE;
   DROP TABLE IF EXISTS public.menus CASCADE;
   DROP TABLE IF EXISTS public.categories CASCADE;
   DROP TABLE IF EXISTS public.profiles CASCADE;
   DROP TABLE IF EXISTS public.kds_stations CASCADE;
   DROP TABLE IF EXISTS public.ingredients CASCADE;
   DROP TABLE IF EXISTS public.suppliers CASCADE;
   DROP TABLE IF EXISTS public.dining_tables CASCADE;
   
   -- Drop views
   DROP VIEW IF EXISTS public.vw_queue_today CASCADE;
   
   -- Drop functions
   DROP FUNCTION IF EXISTS public.gen_payment_code() CASCADE;
   DROP FUNCTION IF EXISTS public.trg_set_payment_code() CASCADE;
   DROP FUNCTION IF EXISTS public.trg_set_queue_no() CASCADE;
   DROP FUNCTION IF EXISTS public.trg_update_timestamp() CASCADE;
   DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
   DROP FUNCTION IF EXISTS public.trg_update_menu_search() CASCADE;
   DROP FUNCTION IF EXISTS public.get_free_tables(INT) CASCADE;
   ```

3. **Jalankan schema baru**:
   - Copy seluruh isi `database-setup-improved.sql`
   - Paste di Supabase SQL Editor
   - Run

4. **Verifikasi**:
   ```sql
   -- Cek semua tables
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   
   -- Cek foreign keys
   SELECT
     tc.table_name, 
     kcu.column_name,
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
   ORDER BY tc.table_name;
   
   -- Cek indexes
   SELECT
     schemaname,
     tablename,
     indexname,
     indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

5. **Test aplikasi** dengan data seed yang sudah disediakan.

---

### **Opsi B: Migration with Data Preservation** (Untuk Database dengan Data Existing)

Jika Anda **sudah memiliki data** yang ingin dipertahankan:

#### Langkah-langkah:

**1. Backup Data Existing**

```sql
-- Backup ke temporary tables
CREATE TABLE backup_orders AS SELECT * FROM public.orders;
CREATE TABLE backup_order_items AS SELECT * FROM public.order_items;
CREATE TABLE backup_payments AS SELECT * FROM public.payments;
CREATE TABLE backup_menus AS SELECT * FROM public.menus;
CREATE TABLE backup_categories AS SELECT * FROM public.categories;
-- ... backup tables lain yang ada datanya
```

**2. Rename Tabel 'tables' (Jika Ada)**

```sql
-- Jika Anda punya tabel 'tables', rename dulu
ALTER TABLE IF EXISTS public.tables RENAME TO dining_tables;

-- Update referensi di orders (jika ada FK)
-- Tidak perlu karena schema lama tidak punya FK
```

**3. Tambahkan Foreign Keys ke Tables Existing**

```sql
-- Pastikan data konsisten sebelum menambahkan FK
-- Hapus orphaned records jika ada
DELETE FROM public.order_items 
WHERE order_id NOT IN (SELECT id FROM public.orders);

DELETE FROM public.order_items 
WHERE menu_id NOT IN (SELECT id FROM public.menus);

-- Tambahkan FK satu per satu
ALTER TABLE public.menus
ADD CONSTRAINT fk_menus_category 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE public.order_items
ADD CONSTRAINT fk_order_items_order 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_items
ADD CONSTRAINT fk_order_items_menu 
FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE RESTRICT;

ALTER TABLE public.payments
ADD CONSTRAINT fk_payments_order 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- ... lanjutkan untuk FK lainnya
```

**4. Ubah Nullable Columns**

```sql
-- Ubah kolom yang seharusnya NOT NULL
-- Pastikan tidak ada NULL value sebelum ALTER
UPDATE public.order_items SET menu_id = '00000000-0000-0000-0000-000000000000' 
WHERE menu_id IS NULL; -- Replace dengan UUID valid atau hapus row

ALTER TABLE public.order_items 
ALTER COLUMN menu_id SET NOT NULL;

ALTER TABLE public.order_items 
ALTER COLUMN order_id SET NOT NULL;

-- ... lanjutkan untuk kolom lain
```

**5. Tambahkan Missing Columns**

```sql
-- Tambahkan kolom baru jika ada
ALTER TABLE public.menus 
ADD COLUMN IF NOT EXISTS search_tsv TSVECTOR;

ALTER TABLE public.menus 
ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 0;

-- ... lanjutkan
```

**6. Buat Indexes**

```sql
-- Copy semua CREATE INDEX dari database-setup-improved.sql
CREATE INDEX IF NOT EXISTS idx_menus_category_id ON public.menus(category_id);
-- ... dst
```

**7. Buat Triggers**

```sql
-- Copy semua trigger functions dan triggers dari database-setup-improved.sql
CREATE OR REPLACE FUNCTION public.trg_update_timestamp() ...
-- ... dst
```

**8. Buat Tables Baru yang Belum Ada**

```sql
-- Jika ada tables baru di schema improved yang belum ada
CREATE TABLE IF NOT EXISTS public.option_groups (...);
-- ... dst
```

**9. Update RLS Policies**

```sql
-- Drop policies lama
DROP POLICY IF EXISTS web_insert_orders ON public.orders;

-- Create policies baru
CREATE POLICY web_insert_orders ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (source = 'web');
-- ... dst
```

**10. Verifikasi dan Test**

```sql
-- Sama seperti Opsi A - cek tables, FKs, indexes
```

---

## 📝 Checklist Migrasi

### Pre-Migration

- [ ] Backup seluruh database (via Supabase Dashboard > Database > Backups)
- [ ] Export data penting ke CSV/JSON (optional)
- [ ] Catat semua custom functions/triggers yang mungkin ada
- [ ] Stop aplikasi sementara (maintenance mode)

### During Migration

- [ ] Pilih strategi: Fresh Install atau Data Preservation
- [ ] Jalankan SQL scripts sesuai strategi
- [ ] Verifikasi struktur tables
- [ ] Verifikasi foreign keys
- [ ] Verifikasi indexes
- [ ] Verifikasi triggers
- [ ] Verifikasi RLS policies

### Post-Migration

- [ ] Test aplikasi secara menyeluruh
- [ ] Test create order
- [ ] Test payment upload
- [ ] Test queue realtime
- [ ] Test menu search
- [ ] Cek logs untuk errors
- [ ] Monitor performa query
- [ ] Remove backup tables (setelah yakin sukses)

---

## 🔍 Verification Queries

### Cek Struktur Tables

```sql
-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Cek Foreign Keys

```sql
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

### Cek Indexes

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Cek Triggers

```sql
SELECT 
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### Cek RLS Policies

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Cek NOT NULL Constraints

```sql
SELECT 
  table_name,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND is_nullable = 'NO'
ORDER BY table_name, ordinal_position;
```

---

## 🐛 Troubleshooting

### Problem: Foreign Key Violation Error

**Error:**
```
ERROR: insert or update on table "order_items" violates foreign key constraint
```

**Solution:**
```sql
-- Cari orphaned records
SELECT * FROM public.order_items 
WHERE order_id NOT IN (SELECT id FROM public.orders);

-- Hapus atau perbaiki
DELETE FROM public.order_items 
WHERE order_id NOT IN (SELECT id FROM public.orders);
```

### Problem: NOT NULL Constraint Violation

**Error:**
```
ERROR: column "menu_id" of relation "order_items" contains null values
```

**Solution:**
```sql
-- Cek NULL values
SELECT * FROM public.order_items WHERE menu_id IS NULL;

-- Option 1: Hapus rows dengan NULL
DELETE FROM public.order_items WHERE menu_id IS NULL;

-- Option 2: Set default value
UPDATE public.order_items 
SET menu_id = '00000000-0000-0000-0000-000000000000' 
WHERE menu_id IS NULL;
```

### Problem: Duplicate Key Error pada Junction Table

**Error:**
```
ERROR: duplicate key value violates unique constraint "menu_stations_pkey"
```

**Solution:**
```sql
-- Cari duplicates
SELECT menu_id, station_key, COUNT(*) 
FROM public.menu_stations 
GROUP BY menu_id, station_key 
HAVING COUNT(*) > 1;

-- Hapus duplicates (keep first occurrence)
DELETE FROM public.menu_stations a
USING public.menu_stations b
WHERE a.ctid < b.ctid
  AND a.menu_id = b.menu_id
  AND a.station_key = b.station_key;
```

### Problem: Trigger auth.users Not Working

**Error:**
```
Profiles not created automatically when new user signs up
```

**Solution:**
```sql
-- Pastikan trigger ada
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Jika tidak ada, buat ulang
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Test dengan create dummy user (via Supabase Auth UI)
```

---

## 📊 Performance Comparison

### Before (Without Indexes)

```sql
EXPLAIN ANALYZE 
SELECT * FROM order_items WHERE order_id = 'xxx';
-- Seq Scan on order_items (cost=0.00..XXX rows=XXX)
-- Planning Time: 0.1ms
-- Execution Time: 15.2ms
```

### After (With Indexes)

```sql
EXPLAIN ANALYZE 
SELECT * FROM order_items WHERE order_id = 'xxx';
-- Index Scan using idx_order_items_order_id (cost=0.29..8.31 rows=1)
-- Planning Time: 0.1ms
-- Execution Time: 0.5ms
```

**Performance Gain: ~30x faster!** ⚡

---

## 🎯 Code Changes Required

### 1. Update Table Name References

**Sebelum:**
```javascript
// Di kode aplikasi (jika ada referensi ke tabel 'tables')
const { data } = await supabase.from('tables').select();
```

**Sesudah:**
```javascript
const { data } = await supabase.from('dining_tables').select();
```

### 2. Update RPC Calls (Tidak Perlu Perubahan)

Function `get_free_tables()` tetap sama, tidak perlu update kode.

### 3. Handle New Constraints

**Sebelum:** Aplikasi bisa insert order_items tanpa order_id valid (orphaned)

**Sesudah:** Database akan reject insert jika order_id tidak valid

```javascript
// Pastikan order sudah ada sebelum insert order_items
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({ ...orderData })
  .select()
  .single();

if (orderError) throw orderError;

// Sekarang bisa insert order_items dengan aman
const { error: itemsError } = await supabase
  .from('order_items')
  .insert(items.map(item => ({ ...item, order_id: order.id })));
```

---

## ✅ Final Checklist

### Database

- [ ] Semua tables berhasil dibuat
- [ ] Semua foreign keys terpasang
- [ ] Semua indexes terbuat
- [ ] Semua triggers berfungsi
- [ ] RLS policies aktif
- [ ] Storage bucket terkonfigurasi
- [ ] Seed data terload (optional)

### Application

- [ ] Supabase credentials updated
- [ ] Kode tidak ada referensi ke `tables` (gunakan `dining_tables`)
- [ ] Test create order berhasil
- [ ] Test payment upload berhasil
- [ ] Test queue realtime berhasil
- [ ] Test menu search berhasil
- [ ] No console errors
- [ ] No Supabase errors di logs

### Documentation

- [ ] Team aware of schema changes
- [ ] Migration guide dibaca dan dipahami
- [ ] Backup procedures documented
- [ ] Rollback plan ready (jika perlu)

---

## 🔄 Rollback Plan

Jika terjadi masalah serius saat migrasi:

### 1. Restore dari Backup

```sql
-- Jika menggunakan backup tables
DROP TABLE IF EXISTS public.orders CASCADE;
CREATE TABLE public.orders AS SELECT * FROM backup_orders;
-- ... restore semua tables

-- Drop improved schema
-- ... (lihat DROP commands di Opsi A)
```

### 2. Restore dari Supabase Backup

- Go to Supabase Dashboard > Database > Backups
- Select backup sebelum migrasi
- Click "Restore"

### 3. Revert Code Changes

```bash
git revert <commit-hash-of-migration>
git push
```

---

## 📞 Support

Jika mengalami kesulitan:

1. **Cek Supabase Logs:**
   - Dashboard > Logs > PostgreSQL Logs

2. **Cek Browser Console:**
   - F12 > Console tab

3. **Test Queries Manually:**
   - Dashboard > SQL Editor

4. **Review Documentation:**
   - `API_REFERENCE.md`
   - `TESTING.md`
   - `README.md`

---

## 🎉 Success Criteria

Migrasi dianggap berhasil jika:

✅ Semua tables terbuat dengan struktur benar  
✅ Semua foreign keys terpasang  
✅ Semua indexes terbuat  
✅ Trigger payment_code & queue_no berfungsi  
✅ Trigger auth.users → profiles berfungsi  
✅ Full-text search berfungsi  
✅ RLS policies tidak block operasi normal  
✅ Aplikasi berjalan tanpa error  
✅ Performa query lebih cepat  
✅ Data integrity terjaga  

---

**Good luck with your migration! 🚀**
