# 🚀 QUICK START GUIDE

## 5 Menit Setup - WarmindoGenz Customer App

### Step 1: Setup Supabase (2 menit)

1. **Buat Akun Supabase**
   - Buka https://supabase.com
   - Klik "Start your project"
   - Login dengan GitHub

2. **Buat Project Baru**
   - Klik "New Project"
   - Isi nama: `warmindogenz`
   - Password database: (simpan password ini)
   - Region: Southeast Asia (Singapore)
   - Klik "Create new project"
   - Tunggu ~2 menit

3. **Run Database Setup**
   - Buka SQL Editor (ikon SQL di sidebar)
   - Copy seluruh isi file `database-setup.sql`
   - Paste ke SQL Editor
   - Klik "Run"
   - Tunggu hingga selesai (✓ Success)

4. **Create Storage Bucket**
   - Buka Storage (ikon folder di sidebar)
   - Klik "New bucket"
   - Name: `payment-proofs`
   - Public bucket: OFF (private)
   - Klik "Create bucket"

5. **Copy API Credentials**
   - Buka Settings > API (ikon gear di sidebar)
   - Copy **Project URL** (ex: https://xxxxx.supabase.co)
   - Copy **anon/public key** (panjang string)

### Step 2: Configure App (1 menit)

1. **Edit Supabase Config**
   - Buka file: `web/shared/js/supabase.js`
   - Ganti baris 11-12:
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co'; // Paste URL Anda
   const SUPABASE_ANON_KEY = 'eyJhbGciOi...'; // Paste anon key Anda
   ```
   - Save file (Ctrl+S)

### Step 3: Test Locally (1 menit)

**Option A: Python**
```powershell
cd "d:\VSCODE (Program)\Customer App\web"
python -m http.server 8000
```

**Option B: Node.js**
```powershell
cd "d:\VSCODE (Program)\Customer App\web"
npx serve -p 8000
```

**Option C: VS Code Live Server**
- Install extension: "Live Server" by Ritwick Dey
- Right-click `web/customer/index.html`
- Click "Open with Live Server"

Open browser: http://localhost:8000/customer/

### Step 4: Quick Test (1 menit)

1. **Test Order Flow:**
   - Click "Pesan"
   - Isi nama: "Test"
   - Pilih "Makan di Tempat"
   - Pilih meja: "Meja 1"
   - Click "Lanjut ke Menu"
   - Click "Tambah ke Keranjang" (3x pada menu berbeda)
   - Click "Keranjang"
   - Click "Buat Pesanan"
   - ✅ Lihat struk + payment code

2. **Test Queue:**
   - Back to home
   - Click "Lihat Antrian"
   - ✅ Lihat pesanan Anda di antrian

**SELESAI! 🎉**

---

## Deploy ke Production

### Option 1: Netlify (Recommended - Gratis)

1. **Via Web UI (Paling Mudah):**
   - Buka https://app.netlify.com
   - Drag & drop folder `web` ke Netlify
   - Wait for deploy (~30 detik)
   - ✅ Done! Copy URL production

2. **Via Git (Recommended untuk production):**
   ```powershell
   # Initialize git (if not already)
   cd "d:\VSCODE (Program)\Customer App"
   git init
   git add .
   git commit -m "Initial commit"
   
   # Push to GitHub
   git remote add origin https://github.com/yourusername/warmindogenz.git
   git push -u origin main
   
   # Connect to Netlify
   # - Login to Netlify
   # - Click "New site from Git"
   # - Select your GitHub repo
   # - Base directory: web
   # - Publish directory: customer
   # - Click "Deploy site"
   ```

### Option 2: Vercel (Gratis)

```powershell
cd "d:\VSCODE (Program)\Customer App"
npx vercel

# Follow prompts:
# - Login
# - Setup project: YES
# - Directory: ./web
# - Build command: (leave empty)
# - Output directory: ./customer
```

### Option 3: GitHub Pages (Gratis)

```powershell
cd "d:\VSCODE (Program)\Customer App"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/warmindogenz.git
git push -u origin main

# Go to GitHub repo > Settings > Pages
# Source: main branch / web/customer folder
# Save
# Wait ~1 minute
# Your site: https://yourusername.github.io/warmindogenz/
```

### Option 4: Shared Hosting (cPanel)

1. **Upload via FTP:**
   - Login ke cPanel
   - Buka File Manager
   - Navigate ke `public_html`
   - Upload seluruh folder `web`
   - Access: https://yourdomain.com/web/customer/

2. **Set as root:**
   - Pindahkan isi `web/customer/` ke `public_html/`
   - Pindahkan `web/shared/` ke `public_html/shared/`
   - Update path di semua HTML (ganti `../shared/` ke `./shared/`)

---

## Post-Deploy Checklist

- [ ] Update CORS di Supabase (if needed)
  - Settings > API > CORS
  - Add production URL
  
- [ ] Test all features on production:
  - [ ] Order flow
  - [ ] Payment upload
  - [ ] Queue realtime
  - [ ] Print receipt
  - [ ] Share WhatsApp
  
- [ ] Setup custom domain (optional):
  - Netlify: Domain settings > Add custom domain
  - Vercel: Settings > Domains > Add
  - GitHub Pages: Settings > Custom domain

- [ ] Enable HTTPS (should be automatic on modern hosts)

---

## Troubleshooting

### 1. "Failed to fetch" Error
**Cause:** Supabase credentials not configured
**Fix:** Check `supabase.js` file has correct URL & key

### 2. CORS Error
**Cause:** Production domain not whitelisted in Supabase
**Fix:** 
- Supabase Dashboard > Settings > API
- Scroll to "CORS"
- Add your production URL
- Save

### 3. Menu tidak muncul
**Cause:** Database belum di-seed
**Fix:** Run database-setup.sql lagi (section 7 - Seed Data)

### 4. Upload bukti gagal
**Cause:** Storage bucket tidak ada
**Fix:** 
- Supabase Dashboard > Storage
- Create bucket: `payment-proofs` (private)

### 5. Realtime tidak jalan
**Cause:** Realtime tidak enabled
**Fix:**
- Supabase Dashboard > Database > Replication
- Enable Realtime untuk tabel: orders, payments

---

## Next Steps

1. **Customize Branding:**
   - Edit warna di `base.css` (line 11-20)
   - Ganti logo/icon
   - Update nama warung jika berbeda

2. **Add Analytics:**
   - Google Analytics
   - Facebook Pixel
   - Custom tracking

3. **Add More Features:**
   - Customer login/register
   - Order history
   - Loyalty points
   - Push notifications

4. **Setup Monitoring:**
   - Supabase Dashboard > Database > Monitoring
   - Check API usage
   - Monitor errors

---

## Support

**Documentation:**
- README.md - Full documentation
- TESTING.md - Testing guide
- database-setup.sql - Database schema

**Community:**
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: (your repo)

**Need Help?**
- Check Supabase docs: https://supabase.com/docs
- Check browser console (F12) for errors
- Review TESTING.md for common issues

---

**Selamat! Aplikasi Anda sudah live! 🚀**

Share link-nya dan mulai terima pesanan! 🍜
