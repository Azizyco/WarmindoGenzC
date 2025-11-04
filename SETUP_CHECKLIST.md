# ✅ SETUP CHECKLIST - WarmindoGenz Customer App

Print atau bookmark halaman ini untuk memastikan setup berhasil!

---

## 📋 Pre-Setup (Persiapan)

- [ ] Sudah memiliki akun Supabase (https://supabase.com)
- [ ] Sudah membaca `QUICKSTART.md`
- [ ] Text editor sudah terinstall (VS Code recommended)
- [ ] Browser modern terinstall (Chrome/Firefox/Edge)

---

## 🗄️ Database Setup

### Step 1: Create Supabase Project
- [ ] Login ke Supabase Dashboard
- [ ] Click "New Project"
- [ ] Isi nama project: `warmindogenz`
- [ ] Pilih password database (SIMPAN password ini!)
- [ ] Pilih region: Southeast Asia (Singapore)
- [ ] Click "Create new project"
- [ ] Tunggu hingga project ready (~2 menit)

### Step 2: Run SQL Setup
- [ ] Buka SQL Editor di Supabase Dashboard
- [ ] Copy seluruh isi file `database-setup.sql`
- [ ] Paste ke SQL Editor
- [ ] Click "Run" atau tekan Ctrl+Enter
- [ ] Tunggu hingga muncul "Success ✓"
- [ ] Verifikasi: Buka "Database" > "Tables" > Lihat tabel `orders` punya kolom `payment_code` dan `queue_no`

### Step 3: Verify Database
- [ ] Buka "Table Editor" > `orders`
- [ ] Cek kolom ada: `payment_code`, `queue_no`
- [ ] Buka "Table Editor" > `menus`
- [ ] Cek ada 12 sample menu (dari seed data)
- [ ] Buka "Database" > "Functions"
- [ ] Cek ada function: `get_free_tables`, `gen_payment_code`

---

## 💾 Storage Setup

### Step 4: Create Storage Bucket
- [ ] Buka "Storage" di Supabase Dashboard
- [ ] Click "New bucket"
- [ ] Name: `payment-proofs`
- [ ] Public bucket: **OFF** (harus private!)
- [ ] Click "Create bucket"
- [ ] Bucket muncul di list

### Step 5: Verify Storage Policies
- [ ] Click bucket `payment-proofs`
- [ ] Buka tab "Policies"
- [ ] Cek ada 2 policies:
  - [ ] "Allow anon upload to payment-proofs"
  - [ ] "Allow anon read own payment-proofs"

---

## 🔑 API Configuration

### Step 6: Get API Credentials
- [ ] Buka "Settings" > "API" di Supabase
- [ ] Copy **Project URL** (contoh: `https://xxxxx.supabase.co`)
- [ ] Copy **anon/public key** (string panjang yang dimulai dengan `eyJ...`)

### Step 7: Update Supabase.js
- [ ] Buka file: `web/shared/js/supabase.js`
- [ ] Ganti baris 11:
  ```javascript
  const SUPABASE_URL = 'https://xxxxx.supabase.co'; // PASTE URL ANDA DI SINI
  ```
- [ ] Ganti baris 12:
  ```javascript
  const SUPABASE_ANON_KEY = 'eyJ...'; // PASTE ANON KEY ANDA DI SINI
  ```
- [ ] Save file (Ctrl+S)

---

## 🧪 Local Testing

### Step 8: Start Local Server

**Option A: Python** (Recommended)
- [ ] Open terminal di folder `web`
- [ ] Run: `python -m http.server 8000`
- [ ] Jika error "python not found", coba: `python3 -m http.server 8000`

**Option B: Node.js**
- [ ] Open terminal di folder `web`
- [ ] Run: `npx serve -p 8000`
- [ ] Tunggu hingga muncul URL

**Option C: VS Code Live Server**
- [ ] Install extension "Live Server"
- [ ] Right-click file `web/customer/index.html`
- [ ] Click "Open with Live Server"

### Step 9: Open in Browser
- [ ] Buka browser
- [ ] Navigasi ke: `http://localhost:8000/customer/`
- [ ] Halaman landing muncul dengan 3 tombol

---

## ✅ Feature Testing

### Test 1: Order Flow (Dine-in)
- [ ] Click tombol "Pesan"
- [ ] Isi nama: "Test User"
- [ ] Isi kontak: "081234567890"
- [ ] Pilih "Makan di Tempat"
- [ ] Pilih meja dari dropdown (misalnya "Meja 1")
- [ ] Click "Lanjut ke Menu"
- [ ] Halaman menu muncul dengan gambar-gambar menu

### Test 2: Add to Cart
- [ ] Di halaman menu, click "Tambah ke Keranjang" pada 3 menu berbeda
- [ ] Badge keranjang muncul di kanan bawah: "Keranjang (3)"
- [ ] Click badge keranjang
- [ ] Halaman checkout muncul dengan 3 item

### Test 3: Checkout
- [ ] Di halaman checkout, verifikasi info customer benar
- [ ] Verifikasi 3 item muncul di tabel
- [ ] Coba ubah quantity dengan tombol + dan -
- [ ] Pilih metode pembayaran: "QRIS"
- [ ] Click "Buat Pesanan"
- [ ] Tunggu ~2 detik
- [ ] Halaman receipt muncul

### Test 4: Receipt
- [ ] Verifikasi payment code muncul (format: WMG-XXXXXX)
- [ ] Verifikasi queue number muncul (format: #1)
- [ ] Verifikasi semua item dan total benar
- [ ] Copy payment code (select & Ctrl+C)

### Test 5: Payment Portal
- [ ] Click "Bayar Sekarang" di halaman receipt
- [ ] Atau buka halaman "Bayar Pesanan" dari home
- [ ] Paste payment code yang tadi dicopy
- [ ] Click "Cari Pesanan"
- [ ] Order details muncul
- [ ] Click "Choose File" dan pilih gambar test (< 5MB)
- [ ] Click "Submit Pembayaran"
- [ ] Success message muncul

### Test 6: Queue Board
- [ ] Kembali ke home page
- [ ] Click "Lihat Antrian"
- [ ] Tabel antrian muncul
- [ ] Order Anda muncul di tabel dengan:
  - [ ] Nomor antrian (#1)
  - [ ] Nama customer
  - [ ] Status "Belum Bayar" atau "Lunas"
  - [ ] Status pesanan "Dipesan"

---

## 🔍 Verification Checklist

### Browser Console (F12 > Console)
- [ ] Tidak ada error merah
- [ ] Tidak ada warning tentang Supabase
- [ ] Console log menunjukkan "Realtime subscribed" (di halaman queue)

### Database Verification (Supabase Dashboard)
- [ ] Buka "Table Editor" > `orders`
- [ ] Ada order baru dengan:
  - [ ] `source` = 'web'
  - [ ] `payment_code` terisi (WMG-XXXXXX)
  - [ ] `queue_no` terisi (1)
  - [ ] `guest_name` terisi
  - [ ] `status` = 'placed'
- [ ] Buka "Table Editor" > `order_items`
- [ ] Ada 3 baris untuk order Anda
- [ ] Buka "Table Editor" > `payments`
- [ ] Ada payment record dengan `status` = 'pending'
- [ ] Buka "Storage" > `payment-proofs`
- [ ] Ada file gambar yang tadi diupload

### Supabase Logs (Optional)
- [ ] Buka "Logs" > "API"
- [ ] Lihat request yang masuk dari aplikasi
- [ ] Semua status 200 (sukses)

---

## 🚀 Ready for Production

### Pre-Deploy Checklist
- [ ] Semua test case di atas PASS
- [ ] Tidak ada console error
- [ ] Database terisi dengan benar
- [ ] Upload file berhasil
- [ ] Realtime update bekerja
- [ ] Mobile responsive (test di DevTools mobile view)

### Deploy Options
- [ ] Pilih hosting platform (Netlify/Vercel/GitHub Pages)
- [ ] Follow deployment guide di `QUICKSTART.md`
- [ ] Deploy aplikasi
- [ ] Test di production URL
- [ ] Update CORS di Supabase (jika perlu)

---

## 🐛 Troubleshooting

### Issue: "Supabase is not defined"
**Fix:**
- [ ] Cek file HTML punya `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
- [ ] Hard refresh browser (Ctrl+Shift+R)

### Issue: "Failed to fetch"
**Fix:**
- [ ] Cek `supabase.js` sudah diupdate dengan URL & key yang benar
- [ ] Cek koneksi internet
- [ ] Cek Supabase project masih aktif

### Issue: "Tidak ada meja kosong"
**Fix:**
- [ ] Buka Supabase SQL Editor
- [ ] Run: `DELETE FROM orders WHERE service_type='dine_in';`
- [ ] Refresh halaman order-start

### Issue: Menu tidak muncul
**Fix:**
- [ ] Buka Supabase SQL Editor
- [ ] Run section "7. SEED DATA" dari `database-setup.sql`
- [ ] Refresh halaman menu

### Issue: Upload file gagal
**Fix:**
- [ ] Pastikan bucket `payment-proofs` exists
- [ ] Cek bucket policies sudah dibuat
- [ ] Cek file size < 5MB
- [ ] Cek file type adalah image

### Issue: Realtime tidak update
**Fix:**
- [ ] Buka "Database" > "Replication" di Supabase
- [ ] Enable Realtime untuk table: `orders`, `payments`
- [ ] Save changes
- [ ] Refresh halaman queue

---

## 📞 Need Help?

### Resources:
- [ ] Baca `README.md` untuk dokumentasi lengkap
- [ ] Baca `TESTING.md` untuk test cases detail
- [ ] Cek Supabase docs: https://supabase.com/docs
- [ ] Join Supabase Discord: https://discord.supabase.com

### Debug Steps:
1. [ ] Open browser DevTools (F12)
2. [ ] Check Console tab for errors
3. [ ] Check Network tab for failed requests
4. [ ] Check Application > Local Storage
5. [ ] Check Application > Session Storage

---

## 🎉 Success Criteria

Aplikasi dianggap berhasil jika:
- ✅ Semua halaman load tanpa error
- ✅ Bisa membuat order dari awal sampai receipt
- ✅ Payment code & queue number ter-generate otomatis
- ✅ Upload bukti bayar berhasil
- ✅ Antrian muncul di queue page
- ✅ Realtime update bekerja
- ✅ Print receipt bekerja
- ✅ Share WhatsApp bekerja
- ✅ Mobile responsive
- ✅ No console errors

---

## 📝 Final Notes

**Setup time:** 10-15 menit (first time)
**Test time:** 5-10 menit
**Total:** ~25 menit dari nol ke production-ready!

**Status Box:**
```
[ ] Setup Started
[ ] Database Configured
[ ] Storage Created
[ ] API Keys Updated
[ ] Local Testing Done
[ ] All Tests Passed
[ ] Ready for Deploy
[ ] DEPLOYED! 🚀
```

---

**Print this checklist dan centang setiap step!**

**Good luck! 🍜**
