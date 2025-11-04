# 📚 API REFERENCE - WarmindoGenz Customer App

Complete API documentation for developers extending this application.

---

## 🔧 Supabase Configuration

### Initialize Client

```javascript
import { supabase } from '../../shared/js/supabase.js';
```

**Configuration:**
- URL: Set in `supabase.js` line 11
- Anon Key: Set in `supabase.js` line 12
- CDN: Loaded via `<script>` tag in HTML

---

## 📊 Database Tables

### 1. `orders` Table

**Schema:**
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT DEFAULT 'web',
  guest_name TEXT,
  contact TEXT,
  service_type TEXT, -- 'dine_in' | 'takeaway'
  table_no TEXT,
  status TEXT DEFAULT 'placed',
  payment_method TEXT, -- 'cash' | 'qris' | 'transfer'
  payment_code TEXT UNIQUE, -- Auto-generated
  queue_no INTEGER, -- Auto-generated daily
  total_amount NUMERIC(10,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Insert Example:**
```javascript
const { data, error } = await supabase
  .from('orders')
  .insert([{
    source: 'web',
    guest_name: 'John Doe',
    contact: '081234567890',
    service_type: 'dine_in',
    table_no: '5',
    status: 'placed',
    payment_method: 'qris',
    total_amount: 50000,
    active: true
  }])
  .select()
  .single();
```

**Select by ID:**
```javascript
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .maybeSingle(); // Use maybeSingle() for safety
```

**Select by Payment Code:**
```javascript
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('payment_code', 'WMG-ABC123')
  .maybeSingle();
```

---

### 2. `order_items` Table

**Schema:**
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  menu_id UUID REFERENCES menus(id),
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Insert Multiple Items:**
```javascript
const items = cart.map(item => ({
  order_id: orderId,
  menu_id: item.menu_id,
  quantity: item.quantity,
  price: item.price
}));

const { error } = await supabase
  .from('order_items')
  .insert(items);
```

**Select with Menu Join:**
```javascript
const { data, error } = await supabase
  .from('order_items')
  .select(`
    *,
    menus (
      id,
      name,
      description,
      price
    )
  `)
  .eq('order_id', orderId);
```

---

### 3. `payments` Table

**Schema:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
  proof_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Insert Payment:**
```javascript
const { data, error } = await supabase
  .from('payments')
  .insert([{
    order_id: orderId,
    amount: 50000,
    method: 'qris',
    status: 'pending',
    proof_image_url: 'path/to/file.jpg'
  }])
  .select()
  .single();
```

**Check Payment Status:**
```javascript
const { data, error } = await supabase
  .from('payments')
  .select('*')
  .eq('order_id', orderId)
  .eq('status', 'success')
  .maybeSingle();

const isPaid = !!data; // true if payment exists
```

---

### 4. `menus` Table

**Schema:**
```sql
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Select Active Menus:**
```javascript
const { data, error } = await supabase
  .from('menus')
  .select('*')
  .eq('is_active', true)
  .order('name');
```

**Filter by Category:**
```javascript
const { data, error } = await supabase
  .from('menus')
  .select('*')
  .eq('category_id', categoryId)
  .eq('is_active', true);
```

---

## 🔄 RPC Functions

### 1. `get_free_tables`

**Purpose:** Get available (not occupied) table numbers

**Definition:**
```sql
CREATE FUNCTION get_free_tables(max_table INT)
RETURNS TABLE(table_no TEXT)
```

**Usage:**
```javascript
const { data, error } = await supabase
  .rpc('get_free_tables', { max_table: 10 });

// Returns: [{ table_no: '1' }, { table_no: '2' }, ...]
```

**Parameters:**
- `max_table` (int): Maximum table number to check (e.g., 10)

**Returns:** Array of available table numbers

---

### 2. `gen_payment_code`

**Purpose:** Generate unique payment code (called by trigger)

**Definition:**
```sql
CREATE FUNCTION gen_payment_code()
RETURNS TEXT
```

**Format:** `WMG-XXXXXX` (6 random alphanumeric characters)

**Note:** Called automatically by trigger, not directly by app

---

## 👁️ Views

### 1. `vw_queue_today`

**Purpose:** Display today's active queue

**Definition:**
```sql
CREATE VIEW vw_queue_today AS
SELECT
  o.id,
  o.queue_no,
  o.guest_name,
  o.contact,
  o.service_type,
  o.table_no,
  o.status AS order_status,
  (EXISTS (
     SELECT 1 FROM payments p
     WHERE p.order_id = o.id AND p.status='success'
   )) AS is_paid,
  o.created_at
FROM orders o
WHERE (o.created_at AT TIME ZONE 'Asia/Jakarta')::DATE = 
      (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
  AND o.status NOT IN ('completed','canceled')
ORDER BY o.queue_no ASC NULLS LAST, o.created_at ASC;
```

**Usage:**
```javascript
const { data, error } = await supabase
  .from('vw_queue_today')
  .select('*')
  .order('queue_no', { ascending: true });
```

**Returns:**
```javascript
[
  {
    id: 'uuid',
    queue_no: 1,
    guest_name: 'John',
    contact: '081234567890',
    service_type: 'dine_in',
    table_no: '5',
    order_status: 'placed',
    is_paid: false,
    created_at: '2025-11-03T10:00:00Z'
  },
  // ...
]
```

---

## 🗄️ Storage (payment-proofs)

### Upload File

```javascript
const file = fileInput.files[0];
const fileName = `${orderId}_${Date.now()}.jpg`;

const { data, error } = await supabase.storage
  .from('payment-proofs')
  .upload(fileName, file);

// Returns: { path: 'uuid_timestamp.jpg' }
```

### Get Public URL (Signed)

```javascript
const { data } = await supabase.storage
  .from('payment-proofs')
  .createSignedUrl('path/to/file.jpg', 60 * 60); // 1 hour

// Returns: { signedUrl: 'https://...' }
```

### List Files

```javascript
const { data, error } = await supabase.storage
  .from('payment-proofs')
  .list();
```

---

## 📡 Realtime Subscriptions

### Subscribe to Table Changes

```javascript
const channel = supabase
  .channel('custom-channel-name')
  .on(
    'postgres_changes',
    {
      event: '*', // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: 'public',
      table: 'orders'
    },
    (payload) => {
      console.log('Change received!', payload);
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new: new row data
      // payload.old: old row data
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed successfully');
    }
  });
```

### Unsubscribe

```javascript
supabase.removeChannel(channel);
```

### Subscribe to Multiple Tables

```javascript
const channel = supabase
  .channel('queue-updates')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, handleChange)
  .subscribe();
```

---

## 🎨 UI Helper Functions

### Import

```javascript
import { 
  showToast, 
  rp, 
  qs, 
  qsa,
  initOfflineIndicator,
  showLoading,
  hideLoading,
  formatDate,
  formatTime,
  getStatusBadge,
  getPaymentMethodLabel,
  getServiceTypeLabel,
  handleSupabaseError
} from '../../shared/js/ui.js';
```

### showToast(type, message, duration)

Display notification toast

```javascript
showToast('success', 'Order created!');
showToast('error', 'Failed to save');
showToast('warning', 'Please check your input');
showToast('info', 'Processing...');
```

**Parameters:**
- `type` (string): 'success' | 'error' | 'warning' | 'info'
- `message` (string): Text to display
- `duration` (number): Auto-hide after ms (default: 3000)

---

### rp(amount)

Format number as Indonesian Rupiah

```javascript
rp(50000); // "Rp50.000"
rp(15000.5); // "Rp15.000"
```

**Parameters:**
- `amount` (number): Amount to format

**Returns:** Formatted string

---

### qs(selector, parent)

Shorthand for `querySelector`

```javascript
const btn = qs('#submit-btn');
const input = qs('.form-input', form);
```

---

### qsa(selector, parent)

Shorthand for `querySelectorAll`

```javascript
const items = qsa('.menu-item');
```

---

### showLoading(message)

Display loading spinner overlay

```javascript
showLoading('Creating order...');
```

---

### hideLoading()

Hide loading spinner

```javascript
hideLoading();
```

---

### formatDate(dateString)

Format date to Indonesian format

```javascript
formatDate('2025-11-03T10:00:00Z');
// "03 Nov 2025, 10:00"
```

---

### formatTime(dateString)

Format time only

```javascript
formatTime('2025-11-03T10:30:00Z');
// "10:30"
```

---

### getStatusBadge(status)

Get HTML badge for order status

```javascript
getStatusBadge('placed');
// '<span class="badge badge-placed">Dipesan</span>'
```

**Status Mapping:**
- `placed` → "Dipesan" (blue)
- `paid` → "Dibayar" (green)
- `confirmed` → "Dikonfirmasi" (indigo)
- `prep` → "Diproses" (yellow)
- `ready` → "Siap" (green)
- `served` → "Disajikan" (purple)
- `completed` → "Selesai" (gray)
- `canceled` → "Dibatalkan" (red)

---

### getPaymentMethodLabel(method)

Get emoji + text label for payment method

```javascript
getPaymentMethodLabel('qris');
// "📱 QRIS"
```

---

### getServiceTypeLabel(type)

Get emoji + text label for service type

```javascript
getServiceTypeLabel('dine_in');
// "🍽️ Makan di Tempat"
```

---

### handleSupabaseError(error, retryFn)

Handle Supabase errors with retry logic

```javascript
try {
  const { data, error } = await supabase.from('orders').select();
  if (error) throw error;
} catch (error) {
  await handleSupabaseError(error, () => loadOrders());
}
```

**Features:**
- Detects rate limit (429)
- Auto-retry after 2 seconds
- Shows user-friendly toast

---

## 🔐 Row Level Security (RLS)

### Check RLS Policies

```sql
-- View all policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check specific table
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

### Example Policies

**Allow Anonymous Insert:**
```sql
CREATE POLICY "web_insert_orders" ON orders
FOR INSERT TO anon, authenticated
WITH CHECK (source = 'web');
```

**Allow Anonymous Select:**
```sql
CREATE POLICY "web_select_orders" ON orders
FOR SELECT TO anon, authenticated
USING (source = 'web');
```

---

## 📱 LocalStorage API

### Cart Management

**Save Cart:**
```javascript
const cart = [
  { menu_id: 'uuid', name: 'Item', price: 15000, quantity: 2 }
];
localStorage.setItem('cart', JSON.stringify(cart));
```

**Get Cart:**
```javascript
const cart = JSON.parse(localStorage.getItem('cart') || '[]');
```

**Clear Cart:**
```javascript
localStorage.removeItem('cart');
```

---

## 📦 SessionStorage API

### Pre-Order Data

**Save Pre-Order:**
```javascript
const preOrder = {
  guest_name: 'John',
  contact: '081234567890',
  service_type: 'dine_in',
  table_no: '5'
};
sessionStorage.setItem('pre_order', JSON.stringify(preOrder));
```

**Get Pre-Order:**
```javascript
const preOrder = JSON.parse(sessionStorage.getItem('pre_order') || 'null');
```

**Clear Pre-Order:**
```javascript
sessionStorage.removeItem('pre_order');
```

---

## 🔍 Error Handling Patterns

### Standard Try-Catch

```javascript
async function loadData() {
  showLoading('Loading...');
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*');
    
    if (error) throw error;
    
    // Process data
    renderData(data);
    
    hideLoading();
  } catch (error) {
    console.error('Error:', error);
    hideLoading();
    showToast('error', 'Failed to load data');
  }
}
```

### With Retry

```javascript
async function loadDataWithRetry() {
  try {
    const { data, error } = await supabase.from('orders').select();
    if (error) throw error;
    return data;
  } catch (error) {
    await handleSupabaseError(error, loadDataWithRetry);
  }
}
```

---

## 📊 Testing API Calls

### Using Browser Console

```javascript
// Test connection
const { data, error } = await supabase.from('orders').select('count', { count: 'exact', head: true });
console.log('Connection:', error ? 'Failed' : 'Success');

// Test RPC
const { data: tables } = await supabase.rpc('get_free_tables', { max_table: 10 });
console.log('Free tables:', tables);

// Test insert
const { data: order } = await supabase.from('orders').insert([{
  source: 'web',
  guest_name: 'Test',
  service_type: 'takeaway',
  payment_method: 'cash',
  total_amount: 15000
}]).select().single();
console.log('Created order:', order);
```

---

## 🎯 Common Patterns

### Pattern 1: CRUD Operations

```javascript
// CREATE
const { data, error } = await supabase
  .from('table_name')
  .insert([{ ... }])
  .select()
  .single();

// READ (single)
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)
  .maybeSingle();

// READ (multiple)
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('status', 'active');

// UPDATE
const { error } = await supabase
  .from('table_name')
  .update({ status: 'completed' })
  .eq('id', id);

// DELETE
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', id);
```

### Pattern 2: Joins

```javascript
const { data } = await supabase
  .from('orders')
  .select(`
    *,
    order_items (
      *,
      menus (name, price)
    )
  `)
  .eq('id', orderId)
  .single();
```

### Pattern 3: Filters

```javascript
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('status', 'placed')           // Equal
  .neq('guest_name', null)          // Not equal
  .gte('total_amount', 50000)       // Greater than or equal
  .lte('total_amount', 100000)      // Less than or equal
  .in('payment_method', ['qris', 'transfer']) // In array
  .order('created_at', { ascending: false });
```

---

## 🚀 Performance Tips

1. **Use `.maybeSingle()` for single records:**
   ```javascript
   .maybeSingle() // Better than .single()
   ```

2. **Select only needed columns:**
   ```javascript
   .select('id, name, price') // Instead of .select('*')
   ```

3. **Use indexes:**
   ```sql
   CREATE INDEX idx_payment_code ON orders(payment_code);
   ```

4. **Batch operations:**
   ```javascript
   .insert(items) // Instead of multiple single inserts
   ```

5. **Cache static data:**
   ```javascript
   // Load menus once, reuse in memory
   ```

---

## 📞 Support

For Supabase-specific issues:
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

---

**API Reference Complete! 🎉**
