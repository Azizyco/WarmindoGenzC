/**
 * UI Helper Functions
 * Toast notifications, formatters, DOM helpers, offline indicator
 */

// DOM helpers
export const qs = (selector, parent = document) => parent.querySelector(selector);
export const qsa = (selector, parent = document) => parent.querySelectorAll(selector);

// Currency formatter (Rupiah)
export function rp(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Toast notification
let toastTimeout;
export function showToast(type, message, duration = 3000) {
  const toastContainer = qs('#toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove toast
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Offline indicator
export function initOfflineIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'offline-indicator';
  indicator.textContent = '⚠️ Tidak ada koneksi internet';
  indicator.style.display = 'none';
  document.body.appendChild(indicator);
  
  function updateStatus() {
    if (navigator.onLine) {
      indicator.style.display = 'none';
    } else {
      indicator.style.display = 'block';
      showToast('error', 'Koneksi internet terputus');
    }
  }
  
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// Loading spinner
export function showLoading(message = 'Memuat...') {
  let spinner = qs('#loading-spinner');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.id = 'loading-spinner';
    spinner.innerHTML = `
      <div class="spinner-backdrop">
        <div class="spinner-content">
          <div class="spinner"></div>
          <p class="spinner-text">${message}</p>
        </div>
      </div>
    `;
    document.body.appendChild(spinner);
  } else {
    qs('.spinner-text', spinner).textContent = message;
  }
  spinner.style.display = 'block';
}

export function hideLoading() {
  const spinner = qs('#loading-spinner');
  if (spinner) spinner.style.display = 'none';
}

// Date formatter
export function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Time formatter
export function formatTime(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Status badge helper
export function getStatusBadge(status) {
  const statusMap = {
    placed: { text: 'Dipesan', class: 'badge-placed' },
    paid: { text: 'Dibayar', class: 'badge-paid' },
    confirmed: { text: 'Dikonfirmasi', class: 'badge-confirmed' },
    prep: { text: 'Diproses', class: 'badge-prep' },
    ready: { text: 'Siap', class: 'badge-ready' },
    served: { text: 'Disajikan', class: 'badge-served' },
    completed: { text: 'Selesai', class: 'badge-completed' },
    canceled: { text: 'Dibatalkan', class: 'badge-canceled' },
  };
  
  const info = statusMap[status] || { text: status, class: 'badge-default' };
  return `<span class="badge ${info.class}">${info.text}</span>`;
}

// Payment method label
export function getPaymentMethodLabel(method) {
  const labels = {
    cash: '💵 Tunai',
    qris: '📱 QRIS',
    transfer: '🏦 Transfer Bank',
  };
  return labels[method] || method;
}

// Service type label
export function getServiceTypeLabel(type) {
  const labels = {
    dine_in: '🍽️ Makan di Tempat',
    takeaway: '🥡 Bungkus',
  };
  return labels[type] || type;
}

// Error handler with retry for rate limiting
export async function handleSupabaseError(error, retryFn = null) {
  if (error.code === '429' || error.message?.includes('rate limit')) {
    showToast('warning', 'Terlalu banyak permintaan. Mencoba lagi...');
    if (retryFn) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await retryFn();
    }
  } else {
    showToast('error', error.message || 'Terjadi kesalahan');
  }
  throw error;
}
