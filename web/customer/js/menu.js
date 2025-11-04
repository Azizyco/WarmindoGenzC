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
const chatbotMessage = qs('#chatbot-message');
const chatbotRecommendation = qs('#chatbot-recommendation');
const recommendationText = qs('#recommendation-text');

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
    
    // Show chatbot recommendation
    showChatbotRecommendation();
    
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

// Chatbot recommendation (rule-based)
function showChatbotRecommendation() {
  const hour = new Date().getHours();
  let recommendation = '';
  
  if (hour >= 6 && hour < 10) {
    recommendation = 'Selamat pagi! Coba menu sarapan kami seperti Nasi Goreng atau Mie Goreng untuk memulai hari Anda! ☀️';
  } else if (hour >= 10 && hour < 15) {
    recommendation = 'Sudah waktunya makan siang! Kami rekomendasikan menu favorit seperti Ayam Geprek atau Soto Ayam. 🍗';
  } else if (hour >= 15 && hour < 18) {
    recommendation = 'Sore hari cocoknya ngemil! Coba Pisang Goreng atau Teh Hangat sebagai teman santai. 🍵';
  } else {
    recommendation = 'Malam ini, nikmati menu spesial kami! Jangan lewatkan Rendang atau menu favorit lainnya. 🌙';
  }
  
  // Add hot items
  if (allMenus.length > 0) {
    const hotItems = allMenus.slice(0, 3).map(m => m.name).join(', ');
    recommendation += `\n\n🔥 Menu Populer: ${hotItems}`;
  }
  
  chatbotMessage.style.display = 'none';
  recommendationText.textContent = recommendation;
  chatbotRecommendation.style.display = 'block';
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

// Initialize
init();
updateCartBadge();
