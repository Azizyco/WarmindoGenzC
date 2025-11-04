# 🧪 TESTING GUIDE - WarmindoGenz Customer App

## Pre-Testing Checklist

- [ ] Database setup completed (`database-setup.sql` executed)
- [ ] Storage bucket `payment-proofs` created
- [ ] Supabase URL & anon key configured in `supabase.js`
- [ ] Web server running (local or deployed)

---

## Test Case 1: Landing Page

**URL:** `/customer/index.html`

### Test Steps:
1. Open landing page
2. Verify 3 buttons are visible:
   - ✅ Pesan
   - ✅ Bayar Pesanan
   - ✅ Lihat Antrian

### Expected Result:
- All 3 buttons clickable
- No console errors
- Offline indicator not showing (if online)

---

## Test Case 2: Order Flow (Dine-in)

**URL:** `/customer/order-start.html`

### Test Steps:
1. Select "Makan di Tempat"
2. Enter name: "Test User"
3. Enter contact: "081234567890"
4. Select a free table from dropdown
5. Click "Lanjut ke Menu"

### Expected Result:
- ✅ Free tables loaded in dropdown
- ✅ Validation passes (name OR contact filled)
- ✅ Redirected to menu page
- ✅ Data saved in sessionStorage

**Console check:**
```javascript
JSON.parse(sessionStorage.getItem('pre_order'))
// Should show: { guest_name, contact, service_type: 'dine_in', table_no }
```

---

## Test Case 3: Order Flow (Takeaway)

### Test Steps:
1. Select "Bungkus"
2. Enter contact only: "081234567890"
3. Click "Lanjut ke Menu"

### Expected Result:
- ✅ Table dropdown hidden
- ✅ Validation passes with contact only
- ✅ Redirected to menu page

---

## Test Case 4: Menu Selection

**URL:** `/customer/menu.html`

### Test Steps:
1. Verify menu items loaded with images
2. Test category filter (select a category)
3. Test sort by price (ascending)
4. Click "Tambah ke Keranjang" on 3 different items
5. Verify cart badge shows "3"
6. Click cart button

### Expected Result:
- ✅ Menu items display with images (or placeholders)
- ✅ Chatbot recommendation shows based on time
- ✅ Filtering works
- ✅ Sorting works
- ✅ Cart count updates correctly
- ✅ Redirected to checkout

**Console check:**
```javascript
JSON.parse(localStorage.getItem('cart'))
// Should show array of 3 items with menu_id, name, price, quantity
```

---

## Test Case 5: Checkout & Order Creation

**URL:** `/customer/checkout.html`

### Test Steps:
1. Verify customer info displayed correctly
2. Verify cart items displayed
3. Change quantity of one item (+ / -)
4. Remove one item (trash button)
5. Select payment method: "QRIS"
6. Click "Buat Pesanan"

### Expected Result:
- ✅ Customer info matches pre_order data
- ✅ Cart items editable
- ✅ Total updates correctly
- ✅ Order created in database
- ✅ Redirected to receipt page with order ID in URL
- ✅ Cart cleared from localStorage

**Database check (Supabase Dashboard):**
```sql
SELECT * FROM orders WHERE source = 'web' ORDER BY created_at DESC LIMIT 1;
-- Should show new order with payment_code, queue_no, etc.

SELECT * FROM order_items WHERE order_id = '<order_id>';
-- Should show order items
```

---

## Test Case 6: Receipt Display

**URL:** `/customer/receipt.html?id=<order_id>`

### Test Steps:
1. Verify payment code displayed (e.g., WMG-7F3K9C)
2. Verify queue number displayed (e.g., #1)
3. Verify order items listed
4. Click "Bayar Sekarang" button
5. Verify redirected to pay page with code pre-filled

### Expected Result:
- ✅ All order details displayed correctly
- ✅ Payment code clickable/copiable
- ✅ Print button opens print dialog
- ✅ Share WA button opens WhatsApp with message

---

## Test Case 7: Payment with QRIS/Transfer

**URL:** `/customer/pay.html`

### Test Steps:
1. Enter payment code from receipt
2. Click "Cari Pesanan"
3. Verify order details displayed
4. Upload a test image (< 5MB)
5. Click "Submit Pembayaran"

### Expected Result:
- ✅ Order found by payment code
- ✅ Order details displayed correctly
- ✅ File upload works
- ✅ Payment record created with status 'pending'
- ✅ Success message displayed

**Database check:**
```sql
SELECT * FROM payments WHERE order_id = '<order_id>';
-- Should show payment with status 'pending'

-- Check storage:
SELECT * FROM storage.objects WHERE bucket_id = 'payment-proofs';
-- Should show uploaded file
```

---

## Test Case 8: Payment with Cash

### Test Steps:
1. Create new order with payment method "Tunai"
2. Go to receipt page
3. Click "Bayar Sekarang"
4. Enter payment code

### Expected Result:
- ✅ Payment page shows "Pembayaran Tunai" message
- ✅ No upload section displayed
- ✅ Total amount displayed prominently

---

## Test Case 9: Queue Display (Realtime)

**URL:** `/customer/queue.html`

### Test Steps:
1. Open queue page
2. Verify current orders displayed
3. Open Supabase Dashboard in another tab
4. Manually update an order status:
   ```sql
   UPDATE orders SET status = 'prep' WHERE id = '<order_id>';
   ```
5. Watch queue page for auto-update (within 2 seconds)

### Expected Result:
- ✅ Queue loaded correctly
- ✅ Stats displayed (total, paid, unpaid)
- ✅ Realtime indicator shows "Live Updates"
- ✅ Table updates automatically when order changes
- ✅ No page refresh needed

---

## Test Case 10: Validation Tests

### Test A: Empty Form Submission
1. Go to order-start page
2. Leave all fields empty except service type
3. Click submit

**Expected:** Error message "Minimal Nama atau Kontak harus diisi"

### Test B: Dine-in without Table
1. Select "Makan di Tempat"
2. Enter name but don't select table
3. Click submit

**Expected:** Error message "Nomor meja wajib dipilih"

### Test C: Invalid Payment Code
1. Go to pay page
2. Enter invalid code "INVALID123"
3. Click "Cari Pesanan"

**Expected:** Error message "Kode pembayaran tidak ditemukan"

### Test D: Large File Upload
1. Go to pay page with valid code (QRIS/Transfer)
2. Try to upload file > 5MB

**Expected:** Error message "Ukuran file maksimal 5MB"

---

## Test Case 11: Mobile Responsiveness

### Test Steps:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone 12 / Galaxy S20
4. Test all pages:
   - Landing
   - Order-start
   - Menu
   - Checkout
   - Receipt
   - Pay
   - Queue

### Expected Result:
- ✅ All pages readable on mobile
- ✅ Buttons easily clickable (not too small)
- ✅ Tables scrollable horizontally if needed
- ✅ Forms usable
- ✅ No horizontal overflow

---

## Test Case 12: Offline Mode

### Test Steps:
1. Open any page
2. Open DevTools > Network tab
3. Change throttling to "Offline"
4. Wait 2 seconds

### Expected Result:
- ✅ Red banner appears at top: "⚠️ Tidak ada koneksi internet"
- ✅ Toast notification shows

---

## Test Case 13: Print Receipt

### Test Steps:
1. Open receipt page
2. Click "Cetak" button
3. In print preview, verify:
   - Action buttons hidden
   - Receipt formatted properly
   - All info visible

### Expected Result:
- ✅ Print dialog opens
- ✅ Receipt looks clean (no buttons)
- ✅ All essential info present

---

## Test Case 14: Share WhatsApp

### Test Steps:
1. Open receipt page
2. Click "Bagikan WA" button

### Expected Result:
- ✅ WhatsApp web/app opens
- ✅ Message pre-filled with order details
- ✅ Link to receipt page included

---

## Performance Tests

### Page Load Times (3G Network):
- Landing: < 2s
- Menu: < 3s
- Receipt: < 2s
- Queue: < 2s

### Database Query Tests:
1. **get_free_tables RPC:** < 500ms
2. **Insert order + items:** < 1s
3. **Load queue view:** < 500ms

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Android

---

## Common Issues & Solutions

### Issue: "Supabase is not defined"
**Solution:** Check if CDN script tag is present in HTML `<head>`

### Issue: Menu images not loading
**Solution:** Check image URLs in database, ensure they're valid

### Issue: Realtime not working
**Solution:** Enable Realtime in Supabase Dashboard > Database > Replication

### Issue: RLS blocking queries
**Solution:** Check RLS policies, ensure anon role has correct permissions

### Issue: Storage upload fails
**Solution:** Check bucket policies, ensure bucket exists and is configured

---

## Final Checklist

After all tests:
- [ ] No console errors on any page
- [ ] All features work as expected
- [ ] Mobile responsive
- [ ] Print works
- [ ] Realtime updates work
- [ ] Data persists correctly in database
- [ ] Storage uploads work
- [ ] Validation working properly

---

## Reporting Bugs

When reporting issues, include:
1. Page URL where error occurred
2. Steps to reproduce
3. Expected vs actual result
4. Browser console errors (F12 > Console)
5. Network errors (F12 > Network)
6. Screenshots

---

**Happy Testing! 🎉**
