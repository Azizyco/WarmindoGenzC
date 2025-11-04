import { supabase } from '../../shared/js/supabase.js';
import { showToast, qs, initOfflineIndicator, showLoading, hideLoading, getStatusBadge, getServiceTypeLabel, formatTime, handleSupabaseError } from '../../shared/js/ui.js';

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
    const { data: queue, error } = await supabase
      .from('vw_queue_today')
      .select('*')
      .order('queue_no', { ascending: true });
    
    if (error) throw error;
    
    renderQueue(queue || []);
    
  } catch (error) {
    console.error('Error loading queue:', error);
    queueList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">⚠️ Gagal memuat antrian</td></tr>';
    await handleSupabaseError(error, loadQueue);
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
  
  // Calculate stats
  totalQueue.textContent = queue.length;
  paidCount.textContent = queue.filter(q => q.is_paid).length;
  unpaidCount.textContent = queue.filter(q => !q.is_paid).length;
  
  // Render table
  queueList.innerHTML = queue.map(item => {
    const queueNo = item.queue_no || '?';
    const guestName = item.guest_name || 'Tamu';
    const serviceLabel = item.service_type === 'dine_in' 
      ? `🍽️ Meja ${item.table_no || '-'}` 
      : '🥡 Bungkus';
    const isPaid = item.is_paid;
    const paymentBadge = isPaid 
      ? '<span class="badge badge-paid">Lunas</span>' 
      : '<span class="badge badge-placed">Belum Bayar</span>';
    const statusBadge = getStatusBadge(item.order_status);
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
