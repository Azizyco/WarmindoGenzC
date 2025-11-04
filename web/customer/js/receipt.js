import { supabase } from '../../shared/js/supabase.js';
import { showToast, rp, qs, initOfflineIndicator, showLoading, hideLoading, getPaymentMethodLabel, getServiceTypeLabel, formatDate, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
initOfflineIndicator();

// Get order ID from URL
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('id');

if (!orderId) {
  showToast('error', 'ID pesanan tidak ditemukan');
  setTimeout(() => window.location.href = 'index.html', 1500);
}

// DOM Elements
const paymentCodeDisplay = qs('#payment-code-display');
const orderIdDisplay = qs('#order-id');
const queueNoDisplay = qs('#queue-no');
const customerInfo = qs('#customer-info');
const orderItems = qs('#order-items');
const totalAmount = qs('#total-amount');
const paymentMethod = qs('#payment-method');
const orderTime = qs('#order-time');
const payNowBtn = qs('#pay-now-btn');
const printBtn = qs('#print-btn');
const shareWaBtn = qs('#share-wa-btn');

let orderData = null;

// Load order
async function loadOrder() {
  showLoading('Memuat struk pesanan...');
  
  try {
    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    
    if (orderError) throw orderError;
    
    if (!order) {
      throw new Error('Pesanan tidak ditemukan');
    }
    
    orderData = order;
    
    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        menus (name)
      `)
      .eq('order_id', orderId);
    
    if (itemsError) throw itemsError;
    
    // Render order
    renderOrder(order, items || []);
    
    hideLoading();
  } catch (error) {
    console.error('Error loading order:', error);
    hideLoading();
    showToast('error', 'Gagal memuat pesanan');
    await handleSupabaseError(error, loadOrder);
  }
}

// Render order
function renderOrder(order, items) {
  // Payment code
  paymentCodeDisplay.textContent = order.payment_code || 'N/A';
  
  // Order info
  orderIdDisplay.textContent = order.id.substring(0, 8).toUpperCase();
  queueNoDisplay.textContent = `#${order.queue_no || '?'}`;
  
  // Customer info
  const customerInfoHtml = [];
  if (order.guest_name) customerInfoHtml.push(`<div><strong>Nama:</strong> ${order.guest_name}</div>`);
  if (order.contact) customerInfoHtml.push(`<div><strong>Kontak:</strong> ${order.contact}</div>`);
  customerInfoHtml.push(`<div><strong>Layanan:</strong> ${getServiceTypeLabel(order.service_type)}</div>`);
  if (order.table_no) customerInfoHtml.push(`<div><strong>Meja:</strong> ${order.table_no}</div>`);
  
  customerInfo.innerHTML = customerInfoHtml.join('');
  
  // Order items
  if (items.length === 0) {
    orderItems.innerHTML = '<tr><td colspan="4" style="text-align: center;">Tidak ada item</td></tr>';
  } else {
    orderItems.innerHTML = items.map(item => {
      const menuName = item.menus?.name || 'Menu Tidak Diketahui';
      const subtotal = item.price * item.quantity;
      
      return `
        <tr>
          <td>${menuName}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${rp(item.price)}</td>
          <td style="text-align: right;">${rp(subtotal)}</td>
        </tr>
      `;
    }).join('');
  }
  
  // Total
  totalAmount.textContent = rp(order.total_amount || 0);
  
  // Payment method
  paymentMethod.textContent = getPaymentMethodLabel(order.payment_method);
  
  // Order time
  orderTime.textContent = formatDate(order.created_at);
}

// Pay now button
payNowBtn.addEventListener('click', () => {
  if (orderData && orderData.payment_code) {
    window.location.href = `pay.html?code=${orderData.payment_code}`;
  } else {
    showToast('error', 'Kode pembayaran tidak tersedia');
  }
});

// Print button
printBtn.addEventListener('click', () => {
  window.print();
});

// Share WhatsApp button
shareWaBtn.addEventListener('click', () => {
  if (!orderData) return;
  
  const message = `🍜 *WarmindoGenz - Struk Pesanan*\n\n` +
    `Kode Pembayaran: *${orderData.payment_code}*\n` +
    `Nomor Antrian: *#${orderData.queue_no}*\n` +
    `Total: *${rp(orderData.total_amount)}*\n\n` +
    `Lihat detail: ${window.location.href}`;
  
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
});

// Initialize
loadOrder();
