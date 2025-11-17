import { supabase } from '../../shared/js/supabase.js';
import { showToast, qs, initOfflineIndicator, showLoading, hideLoading, getStatusBadge, getPaymentBadge, getServiceTypeLabel, formatTime, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
initOfflineIndicator();

// DOM Elements
const queueList = qs('#queue-list');
const totalQueue = qs('#total-queue');
  const paidCount = qs('#paid-count');
const unpaidCount = qs('#unpaid-count');

let realtimeChannel = null;

// Load queue
async function loadQueue() {
  try {
    console.debug('[QUEUE] Loading via view public.vw_queue_today');
    const { data: queue, error } = await supabase
      .from('vw_queue_today')
      .select('*')
      .order('queue_no', { ascending: true });
    
    if (error) throw error;
    
    renderQueue(queue || []);
    
  } catch (error) {
    console.error('Error loading queue:', error);
    // Fallback bila view belum ada di DB (PGRST205: schema cache/view missing)
    if (error?.code === 'PGRST205') {
      console.warn('[QUEUE] View vw_queue_today tidak ditemukan. Menggunakan fallback query ke tabel orders.');
      await loadQueueFromOrdersFallback();
      return;
    }
    queueList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">⚠️ Gagal memuat antrian</td></tr>';
    await handleSupabaseError(error, loadQueue);
  }
}

// Fallback: Query langsung ke orders jika view belum tersedia
async function loadQueueFromOrdersFallback() {
  try {
    console.debug('[QUEUE][FALLBACK] Loading directly from orders');
    // Hitung awal hari (zona waktu lokal browser)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const startIso = startOfDay.toISOString();
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, queue_no, guest_name, contact, service_type, table_no, status, created_at')
      .gte('created_at', startIso)
      .not('status', 'in', '("completed","canceled")')
      .order('queue_no', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    const queue = (orders || []).map(o => ({
      id: o.id,
      queue_no: o.queue_no,
      guest_name: o.guest_name,
      contact: o.contact,
      service_type: o.service_type,
      table_no: o.table_no,
      order_status: o.status,
      // Anggap paid jika status sudah paid/processing/completed
      is_paid: ['paid', 'processing', 'completed', 'confirmed'].includes(o.status),
      created_at: o.created_at,
    }));
    
    renderQueue(queue);
  } catch (fallbackError) {
    console.error('[QUEUE][FALLBACK] Error loading from orders:', fallbackError);
    queueList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">⚠️ Gagal memuat antrian</td></tr>';
    await handleSupabaseError(fallbackError, loadQueueFromOrdersFallback);
  }
}

// Render queue
function renderQueue(queue) {
  if (queue.length === 0) {
    queueList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Belum ada antrian hari ini</td></tr>';
    totalQueue.textContent = '0';
    paidCount.textContent = '0';
    unpaidCount.textContent = '0';
    return;
  }
  
  // Calculate stats (treat confirmed as already paid)
  totalQueue.textContent = queue.length;
  const paidList = queue.filter(q => q.is_paid || q.order_status === 'confirmed' || q.status === 'confirmed');
  paidCount.textContent = paidList.length;
  unpaidCount.textContent = queue.length - paidList.length;
  
  // Render table
  queueList.innerHTML = queue.map(item => {
    const queueNo = item.queue_no || '?';
    const guestName = item.guest_name || 'Tamu';
    const serviceLabel = item.service_type === 'dine_in' 
      ? `🍽️ Meja ${item.table_no || '-'}` 
      : '🥡 Bungkus';
    const isPaid = item.is_paid || item.order_status === 'confirmed' || item.status === 'confirmed';
    const paymentBadge = getPaymentBadge(isPaid);
    const statusBadge = getStatusBadge(item.order_status ?? item.status);
    const time = formatTime(item.created_at);
    
    return `
      <tr>
        <td style="text-align: center;">
          <span class="queue-number">#${queueNo}</span>
        </td>
        <td>
          <strong>${guestName}</strong>
          ${item.contact ? `<br><small style="color: var(--text-secondary);">${item.contact}</small>` : ''}
        </td>
        <td>${serviceLabel}</td>
        <td style="text-align: center;">${paymentBadge}</td>
        <td style="text-align: center;">${statusBadge}</td>
        <td><small>${time}</small></td>
      </tr>
    `;
  }).join('');
}

// Setup realtime subscription
function setupRealtime() {
  // Subscribe to orders table changes
  realtimeChannel = supabase
    .channel('queue-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders'
      },
      (payload) => {
        console.log('Order changed:', payload);
        loadQueue(); // Reload queue on any change
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments'
      },
      (payload) => {
        console.log('Payment changed:', payload);
        loadQueue(); // Reload queue on payment changes
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Realtime subscribed');
        showToast('success', '✅ Terhubung ke realtime updates');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Realtime subscription error');
        showToast('warning', '⚠️ Realtime updates tidak tersedia');
      }
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
});

// Initialize
showLoading('Memuat antrian...');
loadQueue().then(() => {
  hideLoading();
  setupRealtime();
});

// Refresh every 30 seconds as backup
setInterval(() => {
  loadQueue();
}, 30000);
