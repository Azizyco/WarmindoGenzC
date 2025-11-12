import { supabase } from '../../shared/js/supabase.js';
import { showToast, qs, initOfflineIndicator, showLoading, hideLoading, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
initOfflineIndicator();

const form = qs('#order-form');
const tableGroup = qs('#table-group');
const tableSelect = qs('#table_no');
const errorMessage = qs('#error-message');
const serviceTypeRadios = document.querySelectorAll('input[name="service_type"]');

// Toggle table selection based on service type
serviceTypeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'dine_in') {
      tableGroup.style.display = 'block';
      loadFreeTables();
    } else {
      tableGroup.style.display = 'none';
      tableSelect.value = '';
    }
  });
});

// Load free tables from public.tables (status = 'empty')
async function loadFreeTables() {
  try {
    tableSelect.innerHTML = '<option value="">Memuat...</option>';
    // Ambil meja kosong dari tabel baru: public.tables
    const { data, error } = await supabase
      .from('tables')
      .select('label, status, capacity')
      .eq('status', 'empty')
      .order('label', { ascending: true });

    if (error) {
      console.error('[TABLES] select error:', error);
      throw error;
    }

    console.debug('[TABLES] empty tables fetched:', data);

    if (Array.isArray(data) && data.length > 0) {
      tableSelect.innerHTML = '<option value="">Pilih nomor meja</option>';
      data.forEach(row => {
        const option = document.createElement('option');
        option.value = row.label; // simpan label meja
        option.textContent = `Meja ${row.label}${row.capacity ? ` · ${row.capacity} org` : ''}`;
        tableSelect.appendChild(option);
      });
    } else {
      // Fallback via existing RPC (RLS-safe)
      console.debug('[TABLES] direct select returned 0 rows, trying RPC get_free_tables...');
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_free_tables', { p_limit: 10 });
      if (rpcErr) {
        console.error('[TABLES][RPC] get_free_tables error:', rpcErr);
        tableSelect.innerHTML = '<option value="">Tidak ada meja kosong</option>';
        showToast('warning', 'Mohon maaf, saat ini semua meja sedang terisi');
      } else if (Array.isArray(rpcData) && rpcData.length > 0) {
        tableSelect.innerHTML = '<option value="">Pilih nomor meja</option>';
        rpcData.forEach(row => {
          const option = document.createElement('option');
          const label = row.label || row.table_no;
          const cap = row.capacity || row.cap || null;
          option.value = label;
          option.textContent = `Meja ${label}${cap ? ` · ${cap} org` : ''}`;
          tableSelect.appendChild(option);
        });
      } else {
        tableSelect.innerHTML = '<option value="">Tidak ada meja kosong</option>';
        showToast('warning', 'Mohon maaf, saat ini semua meja sedang terisi');
      }
    }
  } catch (error) {
    console.error('Error loading tables:', error);
    tableSelect.innerHTML = '<option value="">Gagal memuat meja</option>';
    await handleSupabaseError(error, loadFreeTables);
  }
}

// Initial load if dine_in is selected
const selectedServiceType = qs('input[name="service_type"]:checked').value;
if (selectedServiceType === 'dine_in') {
  loadFreeTables();
}

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMessage.style.display = 'none';
  
  const guestName = qs('#guest_name').value.trim();
  const contact = qs('#contact').value.trim();
  const serviceType = qs('input[name="service_type"]:checked').value;
  const tableNo = serviceType === 'dine_in' ? qs('#table_no').value : '';
  
  // Validation: Minimal nama atau kontak harus diisi
  if (!guestName && !contact) {
    errorMessage.textContent = '⚠️ Minimal Nama atau Nomor Kontak harus diisi';
    errorMessage.style.display = 'block';
    showToast('error', 'Minimal Nama atau Kontak harus diisi');
    return;
  }
  
  // Validation: If dine_in, table_no is required
  if (serviceType === 'dine_in' && !tableNo) {
    errorMessage.textContent = '⚠️ Silakan pilih nomor meja untuk layanan Makan di Tempat';
    errorMessage.style.display = 'block';
    showToast('error', 'Nomor meja wajib dipilih');
    return;
  }
  
  // Save to sessionStorage
  const preOrder = {
    guest_name: guestName,
    contact: contact,
    service_type: serviceType,
    table_no: tableNo
  };
  
  sessionStorage.setItem('pre_order', JSON.stringify(preOrder));
  
  showToast('success', 'Informasi tersimpan! Menuju menu...');
  
  // Redirect to menu
  setTimeout(() => {
    window.location.href = 'menu.html';
  }, 500);
});
