# Payment Network Request Checklist

## ✅ Yang HARUS Ada di Network Tab (DevTools)

Saat melakukan payment upload di `pay.html`:

### 1. Storage Upload
```
POST /storage/v1/object/payment-proofs/{filename}
Status: 200 OK
```
- Upload file bukti pembayaran ke bucket `payment-proofs`

### 2. RPC Call
```
POST /rest/v1/rpc/create_payment_with_code
Status: 200 OK
Body: {
  "p_payment_code": "ABC123",
  "p_method": "qris",
  "p_proof_url": "https://..."
}
```
- Membuat payment record dan update order status

### 3. Order Refresh (Optional)
```
GET /rest/v1/orders?id=eq.{order_id}&select=*
Status: 200 OK
```
- Refresh data order setelah payment dibuat

## ❌ Yang TIDAK BOLEH Ada

### DILARANG: Direct Payment Table Access
```
❌ POST /rest/v1/payments          (INSERT)
❌ GET  /rest/v1/payments           (SELECT)
❌ PATCH /rest/v1/payments          (UPDATE)
```

**Jika melihat endpoint di atas, berarti ada bug!**

## 🔍 Cara Cek di Browser

1. Buka DevTools (F12)
2. Pilih tab **Network**
3. Upload bukti pembayaran
4. Filter dengan keyword: `payments` atau `create_payment`
5. Pastikan hanya ada `/rpc/create_payment_with_code`

## 📝 Console Logging

Console akan menampilkan:
```
[PAY] Module loaded - NO direct .from("payments") calls allowed, only RPC create_payment_with_code
[PAY] Uploading file to storage bucket: payment-proofs, fileName: ...
[PAY] File uploaded successfully: ...
[PAY] Public URL generated: ...
[PAY] Calling RPC: create_payment_with_code with params: {...}
[PAY] RPC success, payment ID: ...
[PAY] Order refreshed, new status: pending_verification
```

Jika ada `[PAY][RPC ERROR]` atau `[PAY][STORAGE ERROR]`, cek error detail di console.

## 🎯 Expected Flow

1. User pilih file bukti transfer/QRIS
2. File diupload ke Storage `payment-proofs` ✅
3. Dapat public URL dari file ✅
4. Panggil RPC `create_payment_with_code` dengan:
   - `p_payment_code`: kode pembayaran order
   - `p_method`: metode pembayaran (qris/transfer/ewallet)
   - `p_proof_url`: URL file yang diupload
5. RPC function akan:
   - Cari order berdasarkan payment_code
   - Insert ke tabel `payments`
   - Update `orders.status` → `'pending_verification'`
   - Return payment ID
6. UI update untuk show "Menunggu Verifikasi" ✅

## 🚨 Troubleshooting

### Error: "permission denied for table payments"
- **Penyebab**: Ada kode yang masih insert/select langsung ke tabel payments
- **Solusi**: Cari `.from('payments')` di kode, hapus, gunakan RPC

### Error: "function create_payment_with_code does not exist"
- **Penyebab**: RPC function belum dibuat di Supabase
- **Solusi**: Buat function di SQL Editor atau cek typo nama function

### File uploaded tapi payment gagal
- **Cek**: Console log untuk error detail
- **Cek**: Network tab untuk response RPC
- **Cek**: Supabase logs untuk error di backend
