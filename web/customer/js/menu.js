import { supabase } from '../../shared/js/supabase.js';
import { showToast, rp, qs, initOfflineIndicator, showLoading, hideLoading, handleSupabaseError } from '../../shared/js/ui.js';

// Initialize
initOfflineIndicator();

// Check pre_order
const preOrder = JSON.parse(sessionStorage.getItem('pre_order') || 'null');
if (!preOrder) {
  showToast('error', 'Silakan isi informasi pemesanan terlebih dahulu');
  setTimeout(() => window.location.href = 'order-start.html', 1500);
}

// State
let allMenus = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

// Helper: Generate image URL from Supabase Storage
function getMenuImageUrl(imagePath) {
  if (!imagePath) {
    return 'https://placehold.co/400x300?text=No+Image'; // fallback for missing path
  }
  
  // For public bucket 'menu-images'
  const SUPABASE_PROJECT_ID = 'caheywvfmftksrjgdkjr'; // extracted from supabase.js
  return `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/menu-images/${imagePath}`;
  
  // Alternative: If using private bucket, use signed URLs (uncomment below):
  // const { data } = await supabase.storage.from('menu-images').createSignedUrl(imagePath, 3600);
  // return data?.signedUrl || 'https://placehold.co/400x300?text=No+Image';
}

// DOM Elements
const menuGrid = qs('#menu-grid');
const categoryFilter = qs('#category-filter');
const sortSelect = qs('#sort-select');
const cartBtn = qs('#cart-btn');
const cartCount = qs('#cart-count');

// Load data
async function init() {
  showLoading('Memuat menu...');
  
  try {
    // Load menus
    const { data: menus, error: menusError } = await supabase
      .from('menus')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (menusError) throw menusError;
    
    allMenus = menus || [];
    
    // Load categories
    const { data: cats, error: catsError } = await supabase
      .from('menu_categories') // updated: renamed from 'categories' to 'menu_categories'
      .select('*')
      // fixed: is_active column removed (doesn't exist in menu_categories table)
      .order('name');
    
    if (catsError) throw catsError;
    
    categories = cats || [];
    
    // Populate category filter
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      categoryFilter.appendChild(option);
    });
    
    // Render menus
    renderMenus();
    
    hideLoading();
  } catch (error) {
    console.error('Error loading menus:', error);
    hideLoading();
    menuGrid.innerHTML = '<p style="text-align: center; color: var(--error); grid-column: 1/-1;">⚠️ Gagal memuat menu. Silakan refresh halaman.</p>';
    await handleSupabaseError(error, init);
  }
}


// Render menus
function renderMenus() {
  let filtered = [...allMenus];
  
  // Filter by category
  const selectedCategory = categoryFilter.value;
  if (selectedCategory) {
    filtered = filtered.filter(m => m.category_id === selectedCategory);
  }
  
  // Sort
  const sortBy = sortSelect.value;
  switch (sortBy) {
    case 'popular':
      // Assume first items are most popular (or you can add a popularity field)
      break;
    case 'newest':
      filtered.reverse();
      break;
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price);
      break;
  }
  
  // Render
  if (filtered.length === 0) {
    menuGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">Tidak ada menu yang sesuai dengan filter.</p>';
    return;
  }
  
  menuGrid.innerHTML = filtered.map(menu => {
    const category = categories.find(c => c.id === menu.category_id);
    // Use photo_url directly, fallback to placeholder if empty
    const imageUrl = menu.photo_url || 'https://placehold.co/400x300?text=No+Image';
    
    return `
      <div class="card menu-card">
        ${category ? `<span class="badge badge-category">${category.name}</span>` : ''}
        <img src="${imageUrl}" alt="${menu.name}" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
        <div class="menu-name">${menu.name}</div>
        <div class="menu-description">${menu.description || 'Menu lezat dari WarmindoGenz'}</div>
        <div class="menu-price">${rp(menu.price)}</div>
        <button class="btn btn-primary btn-block" onclick="addToCart('${menu.id}')">
          ➕ Tambah ke Keranjang
        </button>
      </div>
    `;
  }).join('');
  
  updateCartBadge();
}

// Add to cart
window.addToCart = function(menuId) {
  const menu = allMenus.find(m => m.id === menuId);
  if (!menu) return;
  
  const existingItem = cart.find(item => item.menu_id === menuId);
  
  if (existingItem) {
    existingItem.quantity += 1;
    showToast('success', `${menu.name} ditambahkan (${existingItem.quantity}x)`);
  } else {
    cart.push({
      menu_id: menuId,
      name: menu.name,
      price: menu.price,
      quantity: 1
    });
    showToast('success', `${menu.name} ditambahkan ke keranjang`);
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
};

// Update cart badge
function updateCartBadge() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  cartCount.textContent = totalItems;
  cartBtn.style.display = 'block'; // Selalu tampilkan tombol keranjang
  
  // Sembunyikan badge jika keranjang kosong
  if (totalItems > 0) {
    cartCount.style.display = 'flex';
  } else {
    cartCount.style.display = 'none';
  }
}

// Go to checkout
cartBtn.addEventListener('click', () => {
  if (cart.length === 0) {
    showToast('warning', 'Keranjang Anda masih kosong');
    return;
  }
  window.location.href = 'checkout.html';
});

// Event listeners
categoryFilter.addEventListener('change', renderMenus);
sortSelect.addEventListener('change', renderMenus);

// ============================================
// CHATBOT GEMINI AI
// ============================================
// Gunakan Supabase Functions client agar URL dan header selalu benar

// DOM Elements
const chatWidget = qs('#chat-widget');
const chatToggle = qs('#chat-toggle');
const chatClose = qs('#chat-close');
const chatMessages = qs('#chat-messages');
const chatForm = qs('#chat-form');
const chatInput = qs('#chat-input');
const chatSendBtn = qs('#chat-send');
const chatSendIcon = qs('#chat-send-icon');

let isChatLoading = false;

// Append message bubble
function appendChatMessage(text, role = 'bot') {
  if (!chatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.style.display = 'flex';
  messageDiv.style.gap = '8px';
  
  if (role === 'user') {
    messageDiv.style.flexDirection = 'row-reverse';
  }
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.style.width = '32px';
  avatar.style.height = '32px';
  avatar.style.borderRadius = '50%';
  avatar.style.display = 'flex';
  avatar.style.alignItems = 'center';
  avatar.style.justifyContent = 'center';
  avatar.style.flexShrink = '0';
  avatar.style.fontSize = '18px';
  
  if (role === 'bot') {
    avatar.style.background = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
    avatar.innerHTML = '<span>🤖</span>';
  } else {
    avatar.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    avatar.innerHTML = '<span>👤</span>';
  }
  
  // Bubble
  const bubble = document.createElement('div');
  bubble.style.maxWidth = '80%';
  bubble.style.padding = '12px';
  bubble.style.borderRadius = '12px';
  bubble.style.fontSize = '14px';
  bubble.style.lineHeight = '1.5';
  bubble.style.whiteSpace = 'pre-wrap';
  bubble.style.wordBreak = 'break-word';
  
  if (role === 'bot') {
    bubble.style.background = 'white';
    bubble.style.color = '#374151';
    bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
  } else {
    bubble.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    bubble.style.color = 'white';
  }
  
  bubble.textContent = text;
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Toggle chat widget
function toggleChat() {
  if (!chatWidget || !chatToggle) return;
  
  const isOpen = chatWidget.style.display === 'block';
  
  if (isOpen) {
    chatWidget.style.display = 'none';
    chatToggle.style.display = 'flex';
  } else {
    chatWidget.style.display = 'block';
    chatToggle.style.display = 'none';
    chatInput?.focus();
  }
}

// Send message to Gemini
async function sendChatMessage(message) {
  if (!message.trim() || isChatLoading) return;
  
  const userMessage = message.trim();
  
  // Display user message
  appendChatMessage(userMessage, 'user');
  
  // Clear input
  if (chatInput) chatInput.value = '';
  
  // Set loading state
  isChatLoading = true;
  if (chatSendIcon) chatSendIcon.textContent = '⏳';
  if (chatSendBtn) chatSendBtn.disabled = true;
  
  // Show typing indicator
  appendChatMessage('Mengetik...', 'bot');
  
  try {
    console.debug('[CHAT] Sending message to Gemini API via Supabase Function...');

    const { data, error } = await supabase.functions.invoke('chat-rekomendasi', {
      body: {
        message: userMessage,
        limit: 20
      }
    });

    if (error) {
      throw new Error(error.message || 'Function invocation failed');
    }

    const reply = data?.reply || 'Maaf, saya tidak bisa memberikan jawaban saat ini.';
    
    console.debug('[CHAT] Received reply from Gemini');
    
    // Remove typing indicator
    if (chatMessages && chatMessages.lastChild) {
      chatMessages.removeChild(chatMessages.lastChild);
    }
    
    // Display bot reply
    appendChatMessage(reply, 'bot');
    
  } catch (error) {
    console.error('[CHAT] Error:', error);
    
    // Remove typing indicator
    if (chatMessages && chatMessages.lastChild) {
      chatMessages.removeChild(chatMessages.lastChild);
    }
    
    // Display error message
    appendChatMessage(
      'Maaf, terjadi kesalahan saat menghubungi asisten. Pastikan Edge Function sudah di-deploy dengan benar.',
      'bot'
    );
    
    showToast('error', 'Gagal menghubungi chatbot');
  } finally {
    // Reset loading state
    isChatLoading = false;
    if (chatSendIcon) chatSendIcon.textContent = 'Kirim';
    if (chatSendBtn) chatSendBtn.disabled = false;
  }
}

// Initialize chatbot
function initChatbot() {
  if (!chatWidget || !chatToggle) {
    console.warn('[CHAT] Chat elements not found');
    return;
  }
  
  console.debug('[CHAT] Initializing chatbot...');
  
  // Toggle button click
  chatToggle.addEventListener('click', toggleChat);
  
  // Close button click
  chatClose?.addEventListener('click', toggleChat);
  
  // Form submit
  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput?.value || '';
    sendChatMessage(message);
  });
  
  console.debug('[CHAT] Chatbot initialized successfully');
}

// Initialize
init();
updateCartBadge();
initChatbot();
