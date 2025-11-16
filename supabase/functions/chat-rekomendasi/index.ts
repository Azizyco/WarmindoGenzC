import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Deno global typings may not be available during static analysis; declare to satisfy type checks
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, limit = 15 } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get menu data from Supabase
    console.log('[CHAT] Fetching menu data from Supabase...')
    
    // Try RPC first, fallback to direct query
    let menus: any[] = []
    
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('menu_catalog', {
          p_limit: limit,
          p_only_active: true
        })
      
      if (rpcError) {
        console.warn('[CHAT] RPC failed, using direct query:', rpcError.message)
        
        // Fallback: direct query
        const { data: directData, error: directError } = await supabase
          .from('menus')
          .select(`
            id,
            name,
            description,
            price,
            is_active,
            category_id,
            menu_categories!inner(name)
          `)
          .eq('is_active', true)
          .limit(limit)
        
        if (directError) throw directError
        
        menus = (directData || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: m.price,
          category_name: m.menu_categories?.name,
          is_active: m.is_active
        }))
      } else {
        menus = rpcData || []
      }
    } catch (err) {
      console.error('[CHAT] Supabase error:', err)
      throw new Error('Failed to fetch menu data')
    }

    if (menus.length === 0) {
      return new Response(
        JSON.stringify({ 
          reply: 'Maaf, saat ini belum ada data menu yang tersedia. Silakan coba lagi nanti.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Build menu context for Gemini
    const menuContext = menus
      .map((m) => {
        const desc = m.description ? ` - ${m.description}` : ''
        const cat = m.category_name || 'Lainnya'
        return `• ${m.name} (${cat}): Rp${m.price.toLocaleString('id-ID')}${desc}`
      })
      .join('\n')

    console.log(`[CHAT] Prepared ${menus.length} menu items for context`)

    // Prepare Gemini prompt
    const systemPrompt = `Kamu adalah asisten rekomendasi menu untuk restoran WarmindoGenz.

ATURAN PENTING:
1. Jawab SELALU dalam Bahasa Indonesia yang sopan dan ramah
2. HANYA rekomendasikan menu yang ada di daftar di bawah
3. JANGAN mengarang atau menyebutkan menu yang tidak ada di daftar
4. Berikan maksimal 5 rekomendasi
5. Format jawaban:
   1. Nama Menu - RpHarga (Kategori)
   2. ...
6. Jika user tanya di luar menu (misal "cuaca"), jawab: "Maaf, aku hanya bisa bantu rekomendasi menu WarmindoGenz."

DAFTAR MENU TERSEDIA (${menus.length} item):
${menuContext}

Sekarang bantu customer dengan pertanyaan mereka tentang menu.`

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    console.log('[CHAT] Calling Gemini API...')
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }]
            },
            {
              role: 'user',
              parts: [{ text: message }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('[CHAT] Gemini API error:', errorText)
      throw new Error(`Gemini API failed: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    const reply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Maaf, saya tidak bisa memberikan rekomendasi saat ini. Silakan coba lagi.'

    console.log('[CHAT] Successfully generated reply')

    return new Response(
      JSON.stringify({ reply }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('[CHAT] Error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error?.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
