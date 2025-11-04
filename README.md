# 🍜 WarmindoGenz - Customer Ordering App

Aplikasi pemesanan pelanggan untuk **WarmindoGenz** (Warung Mie Indomie Genz) dibangun dengan **Vanilla JavaScript** dan **Supabase**.

## 📋 Fitur

### 3 Entry Point Utama:
1. **🛒 Pesan** - Buat pesanan baru dengan memilih menu
2. **💳 Bayar Pesanan** - Bayar menggunakan kode pembayaran
3. **📋 Lihat Antrian** - Pantau antrian realtime

### Fitur Lengkap:
- ✅ Pra-pemesanan (nama, kontak, layanan, pilih meja kosong)
- ✅ Menu dengan gambar, sortir, filter kategori
- ✅ Chatbot rekomendasi sederhana (rule-based)
- ✅ Keranjang belanja dengan localStorage
- ✅ Checkout dan pilih metode pembayaran (Tunai/QRIS/Transfer)
- ✅ Kode pembayaran unik (WMG-XXXXXX)
- ✅ Nomor antrian harian otomatis
- ✅ Upload bukti pembayaran
- ✅ Struk digital (cetak, share WhatsApp)
- ✅ Papan antrian publik realtime
- ✅ Offline indicator
- ✅ Mobile-first responsive design

---

## 🚀 Setup & Installation

### 1. Prerequisites

- Akun **Supabase** (gratis: https://supabase.com)
- Web server atau static hosting (Netlify, Vercel, GitHub Pages, dll)
- Browser modern dengan JavaScript enabled

### 2. Database Setup

1. Login ke **Supabase Dashboard**
2. Buka **SQL Editor**
3. Copy seluruh isi file `database-setup.sql` dan jalankan
4. Tunggu hingga semua query selesai dieksekusi

### 3. Storage Setup

1. Buka **Storage** di Supabase Dashboard
2. Klik **New Bucket**
3. Nama bucket: `payment-proofs`
4. Set sebagai **Private**
5. Klik **Create Bucket**

### 4. Configure Supabase Client

1. Di Supabase Dashboard, buka **Settings > API**
2. Copy **Project URL** dan **anon/public key**
3. Edit file `web/shared/js/supabase.js`:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'; // Ganti dengan URL Anda
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Ganti dengan anon key Anda
```

### 5. Deploy

**Option A: Local Testing**
```bash
cd "d:\VSCODE (Program)\Customer App\web"
python -m http.server 8000
# Atau gunakan: npx serve
# Buka: http://localhost:8000/customer/
```

**Option B: Netlify**
1. Drag & drop folder `web` ke Netlify
2. Set base directory: `customer`
3. Done!

**Option C: Vercel**
```bash
cd "d:\VSCODE (Program)\Customer App\web"
vercel
```

**Option D: GitHub Pages**
1. Push folder `web` ke GitHub repo
2. Enable GitHub Pages di settings
3. Set folder: `/web/customer`

---

## 📁 Struktur Project

```
/web
  /shared
    /js
      supabase.js          # Supabase client init
      ui.js                # Helper functions & UI utilities
    /css
      base.css             # Base styling (responsive, mobile-first)
  /customer
    index.html             # Landing page (3 options)
    order-start.html       # Pra-pemesanan (info & pilih meja)
    menu.html              # Daftar menu + chatbot + filter/sort
    checkout.html          # Review pesanan + pilih payment method
    receipt.html           # Struk + payment code + actions
    pay.html               # Portal pembayaran (input code + upload)
    queue.html             # Papan antrian realtime
    /js
      order-start.js       # Logic untuk order-start.html
      menu.js              # Logic untuk menu.html
      checkout.js          # Logic untuk checkout.html
      receipt.js           # Logic untuk receipt.html
      pay.js               # Logic untuk pay.html
      queue.js             # Logic untuk queue.html
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
1. **Order Start**: Input nama/kontak, pilih layanan (dine-in/takeaway), pilih meja kosong (jika dine-in)
2. **Menu**: Browse menu dengan gambar, filter kategori, sort, chatbot rekomendasi, tambah ke keranjang
3. **Checkout**: Review keranjang, pilih metode bayar (cash/qris/transfer), submit order
4. **Receipt**: Tampilkan struk + payment code + nomor antrian, tombol bayar/cetak/share

### Flow 2: Bayar Pesanan (Payment)

```
Landing Page → Pay → Input Code → View Order → Upload Proof (if not cash)
```

**Detail:**
1. **Pay**: Input payment code (dari struk)
2. Sistem tampilkan detail order
3. Jika **cash**: Tampilkan total, bayar di kasir
4. Jika **QRIS/Transfer**: Upload bukti bayar → Submit ke pending

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
- **orders**: Pesanan pelanggan (dengan `payment_code`, `queue_no`, `guest_name`, `contact`, `table_no`)
- **order_items**: Item dalam pesanan
- **payments**: Pembayaran (status: pending/success/failed)
- **menus**: Daftar menu
- **categories**: Kategori menu

### Key Features:
- **payment_code**: Auto-generated unique code (WMG-XXXXXX)
- **queue_no**: Auto-generated daily queue number
- **RPC get_free_tables**: Query meja kosong untuk dine-in
- **View vw_queue_today**: Antrian hari ini (exclude completed/canceled)

### State Machine:
```
placed → paid → confirmed → prep → ready → served → completed
  \______________________________________________→ canceled
```

---

## 🔧 Customization

### Ganti Jumlah Meja
Edit file `order-start.js`:
```javascript
supabase.rpc('get_free_tables', { max_table: 20 }) // Default: 10
```

### Ganti Warna Tema
Edit file `base.css`:
```css
:root {
  --primary: #f97316;        /* Warna utama (orange) */
  --primary-dark: #ea580c;   /* Warna hover */
  /* ... */
}
```

### Tambah Menu via SQL
```sql
INSERT INTO public.menus (id, category_id, name, description, price, image_url, is_active)
VALUES ('menu-xxx', 'cat-001', 'Nama Menu', 'Deskripsi', 15000, 'https://...', true);
```

---

## 🧪 Testing Checklist

- [ ] Landing page menampilkan 3 tombol
- [ ] Order-start memuat meja kosong (dine-in)
- [ ] Validasi: minimal nama ATAU kontak harus diisi
- [ ] Menu menampilkan gambar & chatbot rekomendasi
- [ ] Keranjang tersimpan di localStorage
- [ ] Checkout berhasil create order + order_items
- [ ] Receipt menampilkan payment_code & queue_no
- [ ] Pay page: input code → tampilkan order
- [ ] Upload bukti bayar (QRIS/Transfer) ke storage
- [ ] Queue page: realtime updates saat admin ubah status
- [ ] Tombol share WhatsApp bekerja
- [ ] Tombol cetak (window.print) bekerja
- [ ] Responsive di mobile & desktop

---

## 🐛 Troubleshooting

### Error: "Kode pembayaran tidak ditemukan"
- Pastikan trigger `set_payment_code` sudah dibuat
- Cek apakah order memiliki kolom `payment_code`

### Error: "Gagal memuat meja"
- Pastikan RPC function `get_free_tables` sudah dibuat
- Cek RLS policy untuk anonymous user

### Realtime tidak update
- Pastikan Realtime enabled di Supabase Dashboard (Database > Replication)
- Cek browser console untuk error

### Upload bukti gagal
- Pastikan bucket `payment-proofs` sudah dibuat
- Cek storage policy untuk anon user
- Maksimal file size: 5MB

### Menu tidak muncul
- Cek apakah data seed sudah dijalankan
- Pastikan `menus.is_active = true`
- Cek RLS policy: `web_select_orders`

---

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

---

## 📄 License

MIT License - Free to use and modify

---

## 🤝 Contributing

Silakan buat pull request atau laporkan issue di repository ini.

---

## 📞 Support

Jika ada pertanyaan atau masalah, silakan buat issue di GitHub repo.

---

**Dibuat dengan ❤️ untuk WarmindoGenz**

Selamat mencoba! 🎉
