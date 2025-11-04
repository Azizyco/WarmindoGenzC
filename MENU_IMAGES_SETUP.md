# 📸 Menu Images with Supabase Storage - Setup Guide

## ✅ What Changed?

Menu images now use **Supabase Storage** instead of external URLs.

### Before:
```javascript
// Used external URLs
const imageUrl = menu.image_url || 'https://placehold.co/...';
```

### After:
```javascript
// Uses Supabase Storage with image_path
const imageUrl = menu.image_path ? getMenuImageUrl(menu.image_path) : '/assets/no-image.png';
```

---

## 🚀 Quick Setup (5 Steps)

### 1️⃣ Create Storage Bucket

Run this SQL in Supabase SQL Editor:

```sql
-- See: setup-menu-images-storage.sql
-- Creates 'menu-images' bucket (PUBLIC)
```

Or via Dashboard:
- Go to **Storage** → **New bucket**
- Name: `menu-images`
- Set as **Public**
- File size limit: **5MB**
- Allowed types: `image/jpeg, image/png, image/webp, image/gif`

### 2️⃣ Add Column to menus Table

```sql
ALTER TABLE public.menus
ADD COLUMN IF NOT EXISTS image_path TEXT;
```

### 3️⃣ Upload Menu Images

Via Dashboard:
- Storage → `menu-images` → **Upload file**
- Upload your menu images (e.g., `indomie-goreng.jpg`)

### 4️⃣ Update Database

```sql
UPDATE public.menus 
SET image_path = 'indomie-goreng.jpg' 
WHERE id = 'menu-001';
```

### 5️⃣ Add Fallback Image

Create file: `web/assets/no-image.png` (400x300px placeholder)

Or use online placeholder:
```javascript
// Fallback already set to /assets/no-image.png
```

---

## 📁 File Structure

```
web/
├── assets/
│   └── no-image.png          ← Add this fallback image
│
├── customer/
│   └── js/
│       └── menu.js            ← Updated (uses image_path)
│
└── shared/
    └── js/
        └── supabase.js        ← Contains project URL
```

---

## 🔧 How It Works

### 1. Database Schema
```sql
menus {
  id: UUID
  name: TEXT
  image_path: TEXT  ← New! (e.g., "indomie-goreng.jpg")
  ...
}
```

### 2. JavaScript Helper Function
```javascript
function getMenuImageUrl(imagePath) {
  if (!imagePath) return '/assets/no-image.png';
  
  const SUPABASE_PROJECT_ID = 'caheywvfmftksrjgdkjr';
  return `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/menu-images/${imagePath}`;
}
```

### 3. Rendering
```javascript
const imageUrl = menu.image_path 
  ? getMenuImageUrl(menu.image_path) 
  : '/assets/no-image.png';

// HTML with fallback
<img src="${imageUrl}" alt="${menu.name}" onerror="this.src='/assets/no-image.png'">
```

---

## 📸 Image URL Format

**Public Bucket URL:**
```
https://caheywvfmftksrjgdkjr.supabase.co/storage/v1/object/public/menu-images/<image_path>
```

**Examples:**
```
https://caheywvfmftksrjgdkjr.supabase.co/storage/v1/object/public/menu-images/indomie-goreng.jpg
https://caheywvfmftksrjgdkjr.supabase.co/storage/v1/object/public/menu-images/foods/nasi-goreng.jpg
https://caheywvfmftksrjgdkjr.supabase.co/storage/v1/object/public/menu-images/drinks/es-teh.jpg
```

---

## 🔒 Private Bucket (Optional)

If you need **private images** (authenticated access only):

### 1. Update SQL:
```sql
-- Create private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', false);  -- public = false
```

### 2. Update JavaScript:
```javascript
async function getMenuImageUrl(imagePath) {
  if (!imagePath) return '/assets/no-image.png';
  
  try {
    const { data, error } = await supabase.storage
      .from('menu-images')
      .createSignedUrl(imagePath, 3600); // expires in 1 hour
    
    if (error) throw error;
    return data.signedUrl || '/assets/no-image.png';
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return '/assets/no-image.png';
  }
}
```

### 3. Make it async:
```javascript
// In renderMenus(), you'll need to handle async URLs
const imageUrls = await Promise.all(
  filtered.map(menu => getMenuImageUrl(menu.image_path))
);
```

---

## 🎨 Fallback Image Options

### Option 1: Local File (Recommended)
```
/assets/no-image.png  ← Create this 400x300px image
```

### Option 2: Online Placeholder
```javascript
onerror="this.src='https://placehold.co/400x300?text=No+Image'"
```

### Option 3: Data URI (Inline)
```javascript
onerror="this.src='data:image/svg+xml,...'"
```

---

## 📊 Storage Policies Summary

| Policy | Who | Action | Purpose |
|--------|-----|--------|---------|
| Public Access | Everyone | SELECT | View menu images |
| Authenticated Upload | Logged in | INSERT | Upload new images |
| Authenticated Update | Logged in | UPDATE | Modify images |
| Authenticated Delete | Logged in | DELETE | Remove images |

---

## 🧪 Testing Checklist

- [ ] Storage bucket `menu-images` created
- [ ] Bucket is set to **public**
- [ ] Column `image_path` added to `menus` table
- [ ] Sample images uploaded to storage
- [ ] Database updated with `image_path` values
- [ ] Fallback image `/assets/no-image.png` exists
- [ ] Open `menu.html` and check images load
- [ ] Check browser console for errors
- [ ] Test with missing `image_path` (should show fallback)
- [ ] Test `onerror` by entering invalid path

---

## 🔧 Troubleshooting

### Images not loading?

**Check 1:** Bucket is public
```sql
SELECT public FROM storage.buckets WHERE name = 'menu-images';
-- Should return: public = true
```

**Check 2:** Storage policies exist
```sql
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%Menu Images%';
```

**Check 3:** Correct URL format
```
https://<project-id>.supabase.co/storage/v1/object/public/menu-images/<image_path>
```

**Check 4:** Image path is correct
```sql
SELECT id, name, image_path FROM menus WHERE image_path IS NOT NULL;
```

### Still not working?

1. Open browser DevTools → Network tab
2. Check for 404 errors on image URLs
3. Verify project ID matches in `supabase.js`
4. Check storage policies allow public SELECT

---

## 📚 Additional Resources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Storage Policies Guide](https://supabase.com/docs/guides/storage/security/access-control)
- [Image Optimization Best Practices](https://web.dev/fast/#optimize-your-images)

---

**Status:** ✅ Setup Complete  
**Next:** Upload menu images and update `image_path` in database!
