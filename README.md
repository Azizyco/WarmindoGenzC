# 🍜 WarmindoGenz - Customer Ordering App

Aplikasi pemesanan pelanggan untuk **WarmindoGenz** (Warung Mie Indomie Genz) dibangun dengan **Vanilla JavaScript** dan **Supabase**.

## 📋 Fitur

### 3 Entry Point Utama:
1. **🛒 Pesan** - Buat pesanan baru dengan memilih menu
2. **💳 Bayar Pesanan** - Bayar menggunakan kode pembayaran
3. **📋 Lihat Antrian** - Pantau antrian realtime


---

## 📁 Struktur Project

```
index.html                 # (Opsional) Landing jika root web/ dijadikan document root

web/
  shared/
    js/
      supabase.js          # Supabase client init (CDN supabase-js v2)
      ui.js                # Helper functions & UI utilities
    css/
      base.css             # Base styling (responsive, mobile-first)

  customer/                # Frontend utama untuk pelanggan (set ini sebagai web root di hosting)
    index.html             # Landing page (3 opsi utama)
    order-start.html       # Pra-pemesanan (info & pilih meja dari tabel "tables")
    menu.html              # Daftar menu + chatbot + filter/sort
    checkout.html          # Review pesanan + pilih metode pembayaran (cash/QRIS/transfer/e-wallet)
    receipt.html           # Struk + payment code + actions
    pay.html               # Portal pembayaran (input kode + instruksi bayar dinamis)
    queue.html             # Papan antrian realtime
    js/
      order-start.js       # Logic pra-pemesanan + load meja kosong (tables/get_free_tables)
      menu.js              # Logic menu & keranjang
      checkout.js          # Buat orders + order_items, pilih metode pembayaran
      receipt.js           # Tampilkan struk & navigasi bayar
      pay.js               # Tampilkan detail order + instruksi pembayaran + upload bukti (proof_url)
      queue.js             # Tampilkan papan antrian realtime
```

---

## 🎯 User Flow

### Flow 1: Pesan (Order)

```
Landing Page → Order Start → Menu → Checkout → Receipt
     ↓              ↓           ↓        ↓         ↓
  3 Tombol    Isi Info &   Pilih   Review &   Struk +
              Pilih Meja   Menu    Submit    Pay Code
```

**Detail:**
1. **Order Start** (`order-start.html`): Input nama/kontak, pilih layanan (dine-in/takeaway). Jika dine-in, aplikasi memuat meja kosong dari `public.tables` (status `empty`) atau RPC `get_free_tables`, lalu menyimpan pilihan ke `pre_order.table_no`.
2. **Menu** (`menu.html`): Browse menu dengan gambar, filter kategori, sort, chatbot rekomendasi, tambah ke keranjang (disimpan di `localStorage.cart`).
3. **Checkout** (`checkout.html`): Render keranjang, pilih metode bayar (`cash` / `qris` / `transfer` / `ewallet`), hitung total, lalu insert ke `orders` + `order_items`. Untuk dine-in, setelah order dibuat frontend memanggil RPC `occupy_table_for_order` untuk mengubah status meja ke `occupied` dan mencatat log di `table_moves`.
4. **Receipt** (`receipt.html`): Tampilkan struk + `payment_code` + `queue_no`, tombol bayar (link ke `pay.html?code=...`), cetak, dan share.

### Flow 2: Bayar Pesanan (Payment)

```
Landing Page → Pay → Input Kode → Lihat Detail → Ikuti Instruksi Bayar
```

**Detail:**
1. **Pay** (`pay.html`): Pelanggan input `payment_code` (bisa juga auto-terisi dari query string `?code=...`).
2. Frontend membaca order dari tabel `orders` dan item dari `order_items` (menggunakan kolom `qty` dan `unit_price`) lalu menampilkan ringkasan pesanan.
3. Aplikasi membaca konfigurasi pembayaran dari tabel `public.settings` untuk key:
  - `payment.qris`  → caption + path gambar QRIS
  - `payment.transfer` → nama bank, nomor rekening, nama pemilik
  - `payment.ewallet` → provider, nomor e-wallet, nama akun
4. Instruksi bayar yang tampil menyesuaikan metode pada order:
  - **cash**: Tampilkan total, instruksi bayar langsung di kasir (tanpa upload bukti).
  - **qris**: Tampilkan gambar QRIS + caption.
  - **transfer**: Tampilkan detail rekening + tombol "Salin".
  - **ewallet**: Tampilkan nomor e-wallet + tombol "Salin" (default tanpa upload bukti).
5. Jika metode adalah **QRIS/Transfer** dan order belum dibayar, user bisa upload bukti bayar (gambar). File diupload ke bucket `payment-proofs`, lalu URL-nya disimpan ke `orders.proof_url` melalui RPC `update_order_proof_url` (tidak langsung menyentuh tabel `payments`).

### Flow 3: Lihat Antrian (Queue)

```
Landing Page → Queue → Realtime Board
```

**Detail:**
- Tabel antrian hari ini (queue_no, nama, meja, status bayar, status order)
- Auto-update via Supabase Realtime
- Refresh otomatis setiap 30 detik

---

## 💾 Database Schema Summary

### Tables Used:
- **orders**: Pesanan pelanggan (dengan `payment_code`, `queue_no`, `guest_name`, `contact`, `table_no`, `proof_url`)
- **order_items**: Item dalam pesanan (`qty`, `unit_price`, `note`)
- **tables**: Manajemen meja (label, capacity, status `empty/occupied/reserved/blocked`)
- **table_moves**: Log perpindahan/occupancy meja per order
- **menus**: Daftar menu (dengan `image_path` untuk Supabase Storage)
- **categories**: Kategori menu
- **settings**: Key-value konfigurasi (digunakan untuk pengaturan pembayaran QRIS/transfer/e-wallet)
- **payments** (opsional / lama): Tabel pembayaran historis jika dipakai oleh backend/admin.

### Key Features:
- **payment_code**: Auto-generated unique code (WMG-XXXXXX)
- **queue_no**: Auto-generated daily queue number
- **Table management**: Enum `public.table_status` + tabel `tables` + `table_moves` + RPC `occupy_table_for_order`.
- **RPC get_free_tables**: Query meja/meja label yang masih kosong untuk dine-in.
- **Payment settings**: Tabel `settings` menyimpan JSON konfigurasi `payment.qris`, `payment.transfer`, `payment.ewallet`.
- **View vw_queue_today**: Antrian hari ini (exclude completed/canceled)

### State Machine:
```
placed → paid → confirmed → prep → ready → served → completed
  \______________________________________________→ canceled
```

---



