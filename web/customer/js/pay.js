import { supabase } from '../../shared/js/supabase.js';
import { showToast, rp, qs, initOfflineIndicator, showLoading, hideLoading, getPaymentMethodLabel, getServiceTypeLabel, formatDate, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
console.debug('[PAY] Module loaded - Upload proof to storage, then save URL to orders.proof_url (no payments RPC).');
initOfflineIndicator();

// Check if payment code is in URL
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get('code');

if (codeFromUrl) {
  qs('#payment-code-input').value = codeFromUrl;
}

// DOM Elements
const codeInputSection = qs('#code-input-section');
const orderDetailsSection = qs('#order-details-section');
const paymentCodeInput = qs('#payment-code-input');
const checkCodeBtn = qs('#check-code-btn');
const orderInfo = qs('#order-info');
const orderItems = qs('#order-items');
const totalAmount = qs('#total-amount');
const paymentMethodInfoCard = qs('#payment-method-info-card');
const paymentMethodInfo = qs('#payment-method-info');
const paymentUploadSection = qs('#payment-upload-section');
const paymentStatusSection = qs('#payment-status-section');
const paymentStatusContent = qs('#payment-status-content');
const paymentProofInput = qs('#payment-proof-input');
const submitPaymentBtn = qs('#submit-payment-btn');
const printReceiptBtn = qs('#print-receipt-btn');

let currentOrder = null;
let cachedPaymentSettings = null; // cache settings to avoid repeated fetch

// Load payment settings from public.settings
async function loadPaymentSettings() {
  if (cachedPaymentSettings) return cachedPaymentSettings;
  try {
    const wantedKeys = ['payment.ewallet', 'payment.qris', 'payment.transfer'];
    const { data, error } = await supabase
      .from('settings')
      .select('key, value, image_path, updated_at, updated_by')
      .in('key', wantedKeys);
    if (error) throw error;

    const map = { ewallet: null, qris: null, transfer: null };
    (data || []).forEach(row => {
      let val = row?.value;
      try {
        if (val && typeof val === 'string') val = JSON.parse(val);
      } catch (_) {
        // keep as-is if not JSON
      }

      if (row.key === 'payment.ewallet') {
        map.ewallet = { ...(val || {}), image_path: row.image_path || val?.image_path || null };
      } else if (row.key === 'payment.qris') {
        map.qris = { ...(val || {}), image_path: row.image_path || val?.image_path || null };
      } else if (row.key === 'payment.transfer') {
        map.transfer = { ...(val || {}), image_path: row.image_path || val?.image_path || null };
      }
    });

    cachedPaymentSettings = map;
    return map;
  } catch (err) {
    console.error('[PAY] Failed to load payment settings:', err);
    return { ewallet: null, qris: null, transfer: null };
  }
}

function getPublicAssetUrl(imagePath) {
  // Fallback relatif dari pay.html (web/customer/pay.html)
  const fallback = './img/no-image.png';
  if (!imagePath) return fallback;

  // Jika sudah berupa URL penuh dari Supabase atau host lain, pakai apa adanya
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  // Jika hanya path (mis. "qris/....png"), biarkan Supabase Storage yang membentuk URL
  // Pastikan nama bucket di sini sama dengan bucket tempat QRIS disimpan.
  try {
	const { data, error } = supabase.storage.from('payment-config').getPublicUrl(imagePath);
    if (error) {
      console.error('[PAY] getPublicUrl error:', error);
      return fallback;
    }
    return (data && data.publicUrl) || fallback;
  } catch (e) {
    console.error('[PAY] getPublicAssetUrl exception:', e);
    return fallback;
  }
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => {
    showToast('success', 'Tersalin ke clipboard');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('success', 'Tersalin ke clipboard'); } catch (_) {}
    document.body.removeChild(ta);
  });
}

// Check payment code
checkCodeBtn.addEventListener('click', async () => {
  const code = paymentCodeInput.value.trim().toUpperCase();
  
  if (!code) {
    showToast('error', 'Silakan masukkan kode pembayaran');
    return;
  }
  
  showLoading('Mencari pesanan...');
  checkCodeBtn.disabled = true;
  
  try {
    // Find order by payment_code
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_code', code)
      .maybeSingle();
    
    if (orderError) throw orderError;
    
    if (!order) {
      hideLoading();
      checkCodeBtn.disabled = false;
      showToast('error', 'Kode pembayaran tidak ditemukan');
      return;
    }
    
    currentOrder = order;
    
    // Load order items + settings
    const [itemsRes, settingsMap] = await Promise.all([
      supabase
        .from('order_items')
        .select(`
          *,
          menus (name)
        `)
        .eq('order_id', order.id),
      loadPaymentSettings()
    ]);
    const { data: items, error: itemsError } = itemsRes;
    
    if (itemsError) throw itemsError;
    
    // Check if already paid - melalui status order saja, tidak query payments langsung
    const alreadyPaid = ['paid', 'processing', 'completed'].includes(order.status);
    const payments = alreadyPaid ? { status: 'success', created_at: order.updated_at } : null;
    
    // Render order
  renderOrder(order, items || [], payments, settingsMap);
    
    // Show order details
    codeInputSection.style.display = 'none';
    orderDetailsSection.style.display = 'block';
    
    hideLoading();
  } catch (error) {
    console.error('Error checking payment code:', error);
    hideLoading();
    checkCodeBtn.disabled = false;
    await handleSupabaseError(error);
  }
});

// Render order
function renderOrder(order, items, existingPayment, settingsMap) {
  // Order info
  const orderInfoHtml = [];
  orderInfoHtml.push(`<div style="display: grid; gap: 0.75rem;">`);
  orderInfoHtml.push(`<div><strong>Kode Pembayaran:</strong> <span style="color: var(--primary); font-size: 1.25rem; font-weight: 700;">${order.payment_code}</span></div>`);
  orderInfoHtml.push(`<div><strong>Nomor Antrian:</strong> #${order.queue_no || '?'}</div>`);
  if (order.guest_name) orderInfoHtml.push(`<div><strong>Nama:</strong> ${order.guest_name}</div>`);
  if (order.contact) orderInfoHtml.push(`<div><strong>Kontak:</strong> ${order.contact}</div>`);
  orderInfoHtml.push(`<div><strong>Layanan:</strong> ${getServiceTypeLabel(order.service_type)}</div>`);
  if (order.table_no) orderInfoHtml.push(`<div><strong>Meja:</strong> ${order.table_no}</div>`);
  orderInfoHtml.push(`<div><strong>Metode:</strong> ${getPaymentMethodLabel(order.payment_method)}</div>`);
  orderInfoHtml.push(`<div><strong>Waktu Pesan:</strong> ${formatDate(order.created_at)}</div>`);
  orderInfoHtml.push(`</div>`);
  
  orderInfo.innerHTML = orderInfoHtml.join('');
  
  // Order items
  if (items.length === 0) {
    orderItems.innerHTML = '<tr><td colspan="3" style="text-align: center;">Tidak ada item</td></tr>';
  } else {
    const safeNum = (v) => {
      if (typeof v === 'number' && isFinite(v)) return v;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };

    orderItems.innerHTML = items.map(item => {
      const menuName = item.menus?.name || 'Menu Tidak Diketahui';
      const price = safeNum(item.unit_price ?? item.price);
      const quantity = safeNum(item.qty ?? item.quantity);
      const subtotal = price * quantity;
      
      return `
        <tr>
          <td>${menuName}</td>
          <td style=\"text-align: center;\">${quantity}</td>
          <td style=\"text-align: right;\">${rp(subtotal)}</td>
        </tr>
      `;
    }).join('');
  }
  
  totalAmount.textContent = rp(order.total_amount || 0);
  
  // Payment section
  if (existingPayment) {
    // Already paid
    paymentUploadSection.style.display = 'none';
    paymentStatusSection.style.display = 'block';
    paymentStatusContent.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
        <h3 style="color: var(--success); margin-bottom: 0.5rem;">Pembayaran Berhasil</h3>
        <p style="color: var(--text-secondary);">Pesanan Anda telah dibayar dan sedang diproses</p>
        <p style="margin-top: 1rem; font-size: 0.875rem;">Waktu Pembayaran: ${formatDate(existingPayment.created_at)}</p>
      </div>
    `;
    // Hide instructions when already paid
    if (paymentMethodInfoCard) paymentMethodInfoCard.style.display = 'none';
  } else if (order.payment_method === 'cash') {
    // Cash payment
    paymentUploadSection.style.display = 'none';
    paymentStatusSection.style.display = 'block';
    paymentStatusContent.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">💵</div>
        <h3 style="margin-bottom: 0.5rem;">Pembayaran Tunai</h3>
        <p style="color: var(--text-secondary);">Silakan bayar di kasir dengan total:</p>
        <p style="font-size: 2rem; font-weight: 700; color: var(--primary); margin-top: 1rem;">${rp(order.total_amount)}</p>
      </div>
    `;
    if (paymentMethodInfoCard) paymentMethodInfoCard.style.display = 'none';
  } else {
    // Non-cash methods - show upload (QRIS/Transfer/e-Wallet)
    const needsUpload = ['qris', 'transfer', 'ewallet'].includes(order.payment_method);
    paymentUploadSection.style.display = needsUpload ? 'block' : 'none';
    paymentStatusSection.style.display = 'none';

    // Show dynamic instructions based on settings
    if (paymentMethodInfoCard && paymentMethodInfo) {
      paymentMethodInfo.innerHTML = renderPaymentInstructions(order.payment_method, settingsMap);
      paymentMethodInfoCard.style.display = 'block';
      // Wire copy buttons
      document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => copyToClipboard(btn.getAttribute('data-copy')));
      });
    }
  }
}

function renderPaymentInstructions(method, settingsMap) {
  const safe = (s) => (s == null ? '' : String(s));
  const notConfigured = `
    <div class="alert alert-warning" style="padding: .75rem 1rem; border-radius: .5rem; background: #fff7e6; border: 1px solid #ffe0a3; color: #8a6d3b;">
      Pengaturan untuk metode <strong>${getPaymentMethodLabel(method)}</strong> belum dikonfigurasi. Silakan hubungi kasir.
    </div>
  `;

  if (method === 'qris') {
    const cfg = settingsMap?.qris;
    if (!cfg) return notConfigured;
    const imgUrl = getPublicAssetUrl(cfg.image_path);
    const caption = cfg.caption || 'Scan QRIS berikut lalu unggah bukti pembayaran.';
    return `
      <div>
        <p style="margin-bottom: .75rem; color: var(--text-secondary);">${safe(caption)}</p>
        <div style="display:flex; justify-content:center;">
          <img src="${imgUrl}" alt="QRIS" style="max-width: 260px; width: 100%; border: 1px solid #eee; border-radius: .5rem;" onerror="this.src='./img/no-image.png'">
        </div>
        <div style="text-align:center; margin-top:.5rem;">
          <a href="${imgUrl}" target="_blank" rel="noopener" class="btn btn-outline" style="display:inline-block;">Buka Gambar</a>
        </div>
      </div>
    `;
  }

  if (method === 'transfer') {
    const cfg = settingsMap?.transfer;
    if (!cfg) return notConfigured;
    const bank = safe(cfg.bank_name || 'Bank');
    const acc = safe(cfg.account_no || '');
    const name = safe(cfg.account_name || '');
    return `
      <div style="display:grid; gap:.5rem;">
        <div><strong>Bank</strong><br>${bank}</div>
        <div style="display:flex; align-items:center; gap:.5rem;">
          <div style="flex:1;">
            <strong>No. Rekening</strong><br>
            <span style="font-size:1.25rem; font-weight:700; letter-spacing: .5px;">${acc}</span>
          </div>
          <button class="btn btn-outline" data-copy="${acc}">Salin</button>
        </div>
        <div><strong>Atas Nama</strong><br>${name}</div>
        <div class="note" style="margin-top:.25rem; color: var(--text-secondary); font-size:.9rem;">Tambahkan berita/keterangan: <strong>Kode ${currentOrder?.payment_code || ''}</strong></div>
      </div>
    `;
  }

  if (method === 'ewallet') {
    const cfg = settingsMap?.ewallet;
    if (!cfg) return notConfigured;
    const prov = safe(cfg.provider || 'e-Wallet');
    const num = safe(cfg.number || '');
    const name = safe(cfg.name || '');
    return `
      <div style="display:grid; gap:.5rem;">
        <div><strong>Provider</strong><br>${prov}</div>
        <div style="display:flex; align-items:center; gap:.5rem;">
          <div style="flex:1;">
            <strong>No. e-Wallet</strong><br>
            <span style="font-size:1.25rem; font-weight:700; letter-spacing: .5px;">${num}</span>
          </div>
          <button class="btn btn-outline" data-copy="${num}">Salin</button>
        </div>
        <div><strong>Nama Akun</strong><br>${name}</div>
      </div>
    `;
  }

  // Default (unknown method)
  return notConfigured;
}

// Submit payment
submitPaymentBtn.addEventListener('click', async () => {
  if (!currentOrder) return;
  
  const file = paymentProofInput.files[0];
  
  if (!file) {
    showToast('error', 'Silakan pilih file bukti pembayaran');
    return;
  }
  
  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('error', 'Ukuran file maksimal 5MB');
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('error', 'File harus berupa gambar');
    return;
  }
  
  showLoading('Mengupload bukti pembayaran...');
  submitPaymentBtn.disabled = true;
  
  try {
    // Upload to storage
    const fileName = `${currentOrder.id}_${Date.now()}.${file.name.split('.').pop()}`;
    console.debug('[PAY] Uploading file to storage bucket: payment-proofs, fileName:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error('[PAY][STORAGE ERROR]', uploadError);
      throw uploadError;
    }
    
    console.debug('[PAY] File uploaded successfully:', uploadData);
    
    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);
    
    console.debug('[PAY] Public URL generated:', publicUrl);
    
    // ✅ Simpan URL bukti via RPC (aman terhadap RLS): update_order_proof_url
    console.debug('[PAY] Calling RPC update_order_proof_url for payment_code:', currentOrder.payment_code);
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_order_proof_url', {
      p_payment_code: currentOrder.payment_code.trim(),
      p_proof_url: publicUrl
    });
    if (rpcError) {
      console.error('[PAY][RPC ERROR] update_order_proof_url failed:', rpcError);
      throw rpcError;
    }
    console.debug('[PAY] RPC update_order_proof_url success:', rpcData);
    
    // Refresh order data to get updated status
    const { data: updatedOrder, error: refreshError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', currentOrder.id)
      .single();
    
    if (!refreshError && updatedOrder) {
      currentOrder = updatedOrder;
      console.debug('[PAY] Order refreshed, new status:', updatedOrder.status);
    }
    
    hideLoading();
  showToast('success', '✅ Bukti pembayaran berhasil diupload dan disimpan.');
    
    // Update UI
    paymentUploadSection.style.display = 'none';
    paymentStatusSection.style.display = 'block';
    paymentStatusContent.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">⏳</div>
        <h3 style="color: var(--warning); margin-bottom: 0.5rem;">Menunggu Verifikasi</h3>
        <p style="color: var(--text-secondary);">Bukti pembayaran Anda telah tersimpan dan menunggu verifikasi staff</p>
        <p style="margin-top: 1rem; font-size: 0.875rem;">Anda akan menerima konfirmasi segera</p>
      </div>
    `;
    
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    hideLoading();
    submitPaymentBtn.disabled = false;
    await handleSupabaseError(error);
  }
});

// Print receipt
printReceiptBtn.addEventListener('click', () => {
  if (currentOrder) {
    window.location.href = `receipt.html?id=${currentOrder.id}`;
  }
});

// Auto-load if code in URL
if (codeFromUrl) {
  setTimeout(() => checkCodeBtn.click(), 500);
}
