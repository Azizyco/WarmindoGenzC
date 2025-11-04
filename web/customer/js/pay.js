import { supabase } from '../../shared/js/supabase.js';
import { showToast, rp, qs, initOfflineIndicator, showLoading, hideLoading, getPaymentMethodLabel, getServiceTypeLabel, formatDate, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
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
const paymentUploadSection = qs('#payment-upload-section');
const paymentStatusSection = qs('#payment-status-section');
const paymentStatusContent = qs('#payment-status-content');
const paymentProofInput = qs('#payment-proof-input');
const submitPaymentBtn = qs('#submit-payment-btn');
const printReceiptBtn = qs('#print-receipt-btn');

let currentOrder = null;

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
    
    // Load order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        menus (name)
      `)
      .eq('order_id', order.id);
    
    if (itemsError) throw itemsError;
    
    // Check if already paid
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'success')
      .maybeSingle();
    
    if (paymentsError && paymentsError.code !== 'PGRST116') {
      throw paymentsError;
    }
    
    // Render order
    renderOrder(order, items || [], payments);
    
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
function renderOrder(order, items, existingPayment) {
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
    orderItems.innerHTML = items.map(item => {
      const menuName = item.menus?.name || 'Menu Tidak Diketahui';
      const subtotal = item.price * item.quantity;
      
      return `
        <tr>
          <td>${menuName}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${rp(subtotal)}</td>
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
  } else {
    // QRIS/Transfer - show upload
    paymentUploadSection.style.display = 'block';
    paymentStatusSection.style.display = 'none';
  }
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
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    // Insert payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        order_id: currentOrder.id,
        amount: currentOrder.total_amount,
        method: currentOrder.payment_method,
        status: 'pending',
        proof_image_url: uploadData.path
      }])
      .select()
      .single();
    
    if (paymentError) throw paymentError;
    
    hideLoading();
    showToast('success', '✅ Bukti pembayaran berhasil diupload!');
    
    // Update UI
    paymentUploadSection.style.display = 'none';
    paymentStatusSection.style.display = 'block';
    paymentStatusContent.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">⏳</div>
        <h3 style="color: var(--warning); margin-bottom: 0.5rem;">Menunggu Verifikasi</h3>
        <p style="color: var(--text-secondary);">Bukti pembayaran Anda sedang diverifikasi oleh staff kami</p>
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
