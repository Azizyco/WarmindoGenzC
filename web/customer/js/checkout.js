import { supabase } from '../../shared/js/supabase.js';
import { showToast, rp, qs, initOfflineIndicator, showLoading, hideLoading, getServiceTypeLabel, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
initOfflineIndicator();

// Check pre_order and cart
const preOrder = JSON.parse(sessionStorage.getItem('pre_order') || 'null');
const cart = JSON.parse(localStorage.getItem('cart') || '[]');

if (!preOrder || cart.length === 0) {
  showToast('error', 'Keranjang kosong atau informasi pemesanan tidak lengkap');
  setTimeout(() => window.location.href = 'order-start.html', 1500);
}

// DOM Elements
const customerInfo = qs('#customer-info');
const cartItems = qs('#cart-items');
const totalAmount = qs('#total-amount');
const submitBtn = qs('#submit-order');
const backBtn = qs('#back-to-menu');

// Render customer info
function renderCustomerInfo() {
  customerInfo.innerHTML = `
    <div style="display: grid; gap: 0.75rem;">
      ${preOrder.guest_name ? `<div><strong>Nama:</strong> ${preOrder.guest_name}</div>` : ''}
      ${preOrder.contact ? `<div><strong>Kontak:</strong> ${preOrder.contact}</div>` : ''}
      <div><strong>Layanan:</strong> ${getServiceTypeLabel(preOrder.service_type)}</div>
      ${preOrder.table_no ? `<div><strong>Nomor Meja:</strong> ${preOrder.table_no}</div>` : ''}
    </div>
  `;
}

// Render cart items
function renderCart() {
  if (cart.length === 0) {
    cartItems.innerHTML = '<tr><td colspan="5" style="text-align: center;">Keranjang kosong</td></tr>';
    totalAmount.textContent = rp(0);
    return;
  }
  
  let total = 0;
  
  cartItems.innerHTML = cart.map((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    
    return `
      <tr>
        <td>${item.name}</td>
        <td style="text-align: center;">
          <button class="btn btn-sm" onclick="updateQuantity(${index}, -1)">-</button>
          <span style="margin: 0 0.5rem; font-weight: 600;">${item.quantity}</span>
          <button class="btn btn-sm" onclick="updateQuantity(${index}, 1)">+</button>
        </td>
        <td style="text-align: right;">${rp(item.price)}</td>
        <td style="text-align: right; font-weight: 600;">${rp(subtotal)}</td>
        <td style="text-align: center;">
          <button class="btn btn-sm btn-secondary" onclick="removeItem(${index})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
  
  totalAmount.textContent = rp(total);
}

// Update quantity
window.updateQuantity = function(index, change) {
  if (cart[index]) {
    cart[index].quantity += change;
    
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
    
    if (cart.length === 0) {
      showToast('warning', 'Keranjang kosong! Mengarahkan ke menu...');
      setTimeout(() => window.location.href = 'menu.html', 1500);
    }
  }
};

// Remove item
window.removeItem = function(index) {
  if (cart[index]) {
    const itemName = cart[index].name;
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
    showToast('info', `${itemName} dihapus dari keranjang`);
    
    if (cart.length === 0) {
      showToast('warning', 'Keranjang kosong! Mengarahkan ke menu...');
      setTimeout(() => window.location.href = 'menu.html', 1500);
    }
  }
};

// Submit order
submitBtn.addEventListener('click', async () => {
  if (cart.length === 0) {
    showToast('error', 'Keranjang kosong');
    return;
  }
  
  const paymentMethod = qs('input[name="payment_method"]:checked').value;
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  showLoading('Membuat pesanan...');
  submitBtn.disabled = true;
  
  try {
    // Insert order
    const orderData = {
      source: 'web',
      service_type: preOrder.service_type,
      table_no: preOrder.table_no || null,
      status: 'placed',
      guest_name: preOrder.guest_name || null,
      contact: preOrder.contact || null,
      payment_method: paymentMethod,
      total_amount: total,
      active: true
    };
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select('id')
      .single();
    
    if (orderError) throw orderError;
    
    // Insert order items
    const itemsPayload = cart.map(item => ({
      order_id: order.id,
      menu_id: item.menu_id,
      qty: item.quantity,        // i.quantity dari cart -> disimpan ke kolom `qty`
      unit_price: item.price,    // i.price dari cart -> disimpan ke kolom `unit_price`
      note: item.note ?? null
    }));
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsPayload);
    
    if (itemsError) throw itemsError;
    
    // Clear cart and pre_order
    localStorage.removeItem('cart');
    sessionStorage.removeItem('pre_order');
    
    hideLoading();
    showToast('success', 'Pesanan berhasil dibuat! 🎉');
    
    // Redirect to receipt
    setTimeout(() => {
      window.location.href = `receipt.html?id=${order.id}`;
    }, 1000);
    
  } catch (error) {
    console.error('Error creating order:', error);
    hideLoading();
    submitBtn.disabled = false;
    await handleSupabaseError(error);
  }
});

// Back to menu
backBtn.addEventListener('click', () => {
  window.location.href = 'menu.html';
});

// Initialize
renderCustomerInfo();
renderCart();
