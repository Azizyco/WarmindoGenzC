# Setup Chatbot Gemini AI untuk WarmindoGenz

Panduan lengkap untuk deploy chatbot rekomendasi menu menggunakan Gemini AI yang terintegrasi dengan Supabase.

## 📋 Prerequisites

1. Akun Supabase aktif dengan project WarmindoGenz
2. Google AI Studio API Key (Gemini)
3. Supabase CLI terinstall (opsional untuk local testing)

## 🔑 1. Dapatkan Gemini API Key

1. Buka: https://aistudio.google.com/apikey
2. Klik **"Create API Key"**
3. Copy API key yang dihasilkan (format: `AIzaSy...`)
4. **PENTING**: Jangan share API key ini ke publik!

## 🗄️ 2. Setup Database (RPC Function)

Buka **Supabase Dashboard** → **SQL Editor** → jalankan:

```sql
-- File: create-menu-catalog-rpc.sql
-- (Lihat file create-menu-catalog-rpc.sql di root project)
```

Atau copy-paste dari file `create-menu-catalog-rpc.sql`.

**Verifikasi** (fungsi bernama `menu_catalog`):
```sql
-- Test RPC baru
SELECT * FROM menu_catalog(10, true, NULL);
```

Seharusnya mengembalikan list menu dengan kolom:
- id, name, description, price
- category_name, is_active

## ☁️ 3. Deploy Edge Function ke Supabase

### Via Supabase Dashboard (Cara Termudah)

1. Buka **Supabase Dashboard** → **Edge Functions**
2. Klik **"Create a new function"**
3. Nama function: `chat-rekomendasi`
4. Copy-paste seluruh kode dari `supabase/functions/chat-rekomendasi/index.ts`
5. Klik **"Deploy"**

### Via Supabase CLI (Alternatif)

```bash
# Login
supabase login

# Link project
supabase link --project-ref <YOUR_PROJECT_ID>

# Deploy function
supabase functions deploy chat-rekomendasi

# Set secrets
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

## 🔐 4. Set Environment Variables

Di **Supabase Dashboard** → **Edge Functions** → **chat-rekomendasi** → **Settings**:

Tambahkan secrets:

| Key | Value | Keterangan |
|-----|-------|------------|
| `GEMINI_API_KEY` | `AIzaSy...` | API key dari Google AI Studio |
| `SUPABASE_URL` | `https://caheywvfmftksrjgdkjr.supabase.co` | URL project Supabase Anda |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Service role key (dari Settings → API) |

**Cara set via Dashboard**:
1. Edge Functions → chat-rekomendasi
2. Tab "Settings" atau "Secrets"
3. Add secret → masukkan key dan value
4. Save

## 🌐 5. Update URL di Frontend

Edit file `web/customer/js/menu.js`, ganti URL:

```javascript
// Baris ~215
const CHAT_API_URL = 'https://<PROJECT_ID>.supabase.co/functions/v1/chat-rekomendasi';
```

Ganti `<PROJECT_ID>` dengan project ID Supabase Anda (contoh: `caheywvfmftksrjgdkjr`).

**URL lengkap format**:
```
https://caheywvfmftksrjgdkjr.supabase.co/functions/v1/chat-rekomendasi
```

## ✅ 6. Testing

### Test Edge Function via curl

```bash
curl -X POST https://<PROJECT_ID>.supabase.co/functions/v1/chat-rekomendasi \
  -H "Content-Type: application/json" \
  -d '{"message": "rekomendasi menu pedas", "limit": 5}'
```

**Expected response**:
```json
{
  "reply": "Berikut rekomendasi menu pedas untuk Anda:\n1. Ayam Geprek - Rp18000 (Makanan / Dapur)\n2. ..."
}
```

### Test di Browser

1. Buka `http://localhost:5500/web/customer/menu.html` (atau deploy ke server)
2. Klik tombol chat 💬 di kanan bawah
3. Ketik: `"rekomendasi menu murah"`
4. Tunggu respons dari bot

**Cek Console**:
- `[CHAT] Sending message to Gemini API...`
- `[CHAT] Received reply from Gemini`

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY not configured"

**Solusi**: Set secret `GEMINI_API_KEY` di Edge Function settings.

### Error: "Failed to fetch menu data"

**Solusi**:
1. Pastikan RPC `menu_catalog` sudah dibuat
2. Cek permission: `GRANT EXECUTE ON FUNCTION public.menu_catalog...`
3. Cek `SUPABASE_SERVICE_ROLE_KEY` benar

### Error: "Gemini API failed: 400"

**Solusi**:
1. Cek API key valid
2. Pastikan model `gemini-1.5-flash` tersedia
3. Cek quota API di Google AI Studio

### Chat widget tidak muncul

**Solusi**:
1. Pastikan `menu.html` sudah ada widget HTML
2. Cek Console browser untuk error JS
3. Pastikan `initChatbot()` dipanggil di `menu.js`

### Bot jawab "Maaf, belum ada menu..."

**Solusi**:
1. Cek database ada data di tabel `menus` dengan `is_active = true`
2. Test RPC manual: `SELECT * FROM menu_catalog(10, true, NULL);`

## 📊 Monitoring

### Cek Logs Edge Function

Supabase Dashboard → Edge Functions → chat-rekomendasi → **Logs**

Cari:
- `[CHAT] Fetching menu data...`
- `[CHAT] Prepared X menu items...`
- `[CHAT] Calling Gemini API...`
- `[CHAT] Successfully generated reply`

### Cek Usage Gemini API

Google AI Studio → API Keys → klik key Anda → lihat usage/quota

## 🎨 Kustomisasi

### Ubah Prompt Bot

Edit file `supabase/functions/chat-rekomendasi/index.ts` bagian `systemPrompt`:

```typescript
const systemPrompt = `Kamu adalah asisten rekomendasi menu untuk restoran WarmindoGenz.

ATURAN PENTING:
1. Jawab SELALU dalam Bahasa Indonesia yang sopan dan ramah
2. HANYA rekomendasikan menu yang ada di daftar di bawah
...
`
```

Re-deploy setelah ubah.

### Ubah Tampilan Widget

Edit `web/customer/menu.html` bagian `<div id="chat-widget">`:
- Warna background
- Ukuran widget
- Font, spacing, dll

### Ubah Limit Menu

Di `menu.js`, bagian `sendChatMessage`:

```javascript
body: JSON.stringify({
  message: userMessage,
  limit: 30  // ubah dari 20 ke 30
})
```

## 🚀 Production Checklist

- [ ] API key Gemini sudah di-set sebagai secret (bukan hardcode)
-- [ ] RPC `menu_catalog` sudah dibuat dan di-grant
- [ ] Edge Function deployed dan URL sudah benar di `menu.js`
- [ ] Test di berbagai device (mobile, desktop)
- [ ] Monitor logs untuk error
- [ ] Set rate limiting (opsional, via Supabase dashboard)

## 📝 Notes

- **CORS**: Edge function sudah support CORS (semua origin `*`)
- **Keamanan**: API key tidak pernah terekspos ke frontend
- **Performance**: Widget lazy load, tidak memperlambat page load
- **Cost**: Gemini API free tier: 15 RPM, 1 juta tokens/hari (cukup untuk traffic kecil-menengah)

## 🔗 Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Google AI Studio](https://aistudio.google.com/)

---

**Selesai!** Chatbot siap dipakai. 🎉

Jika ada error, cek troubleshooting atau lihat logs di Supabase Dashboard.
