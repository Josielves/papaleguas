import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }

function response(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Metodo nao permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return response({ error: 'Servico nao configurado.' }, 500)

    const body = await request.json()
    const type = body?.type
    const language = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(body?.language ?? '') ? body.language : 'pt-BR'
    const baseUrl = Deno.env.get('GEOCODING_BASE_URL') ?? 'https://nominatim.openstreetmap.org'
    const provider = Deno.env.get('GEOCODING_PROVIDER') ?? 'nominatim-public'
    const userAgent = Deno.env.get('GEOCODING_USER_AGENT') ?? 'Papaleguas/2.0'
    const url = new URL(type === 'reverse' ? '/reverse' : '/search', baseUrl)
    let cacheSeed = ''

    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('accept-language', language)

    if (type === 'reverse') {
      const lat = Number(body?.lat)
      const lng = Number(body?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return response({ error: 'Coordenadas invalidas.' }, 400)
      }
      const roundedLat = lat.toFixed(5)
      const roundedLng = lng.toFixed(5)
      cacheSeed = `reverse:${roundedLat}:${roundedLng}:${language}`
      url.searchParams.set('lat', roundedLat)
      url.searchParams.set('lon', roundedLng)
    } else if (type === 'search') {
      const query = String(body?.query ?? '').trim().replace(/\s+/g, ' ')
      if (query.length < 3 || query.length > 180) return response({ error: 'Endereco invalido.' }, 400)
      cacheSeed = `search:${query.toLocaleLowerCase('pt-BR')}:${language}`
      url.searchParams.set('q', query)
      url.searchParams.set('limit', '1')
    } else {
      return response({ error: 'Tipo de consulta invalido.' }, 400)
    }

    const cacheKey = await sha256(cacheSeed)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: cached } = await admin
      .from('geocoding_cache')
      .select('response')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached?.response) return response({ ...cached.response, cached: true })

    if (provider === 'nominatim-public') {
      const { data: claimed, error: claimError } = await admin.rpc('claim_geocoding_request', {
        p_provider: provider,
        p_min_interval_ms: 1100,
      })
      if (claimError) throw claimError
      if (!claimed) {
        return response({ error: 'Geocodificacao ocupada. Tente novamente em instantes.' }, 429, {
          'Retry-After': '2',
        })
      }
    }

    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': language,
        'User-Agent': userAgent,
      },
    })
    if (!upstream.ok) return response({ error: 'Provedor de geocodificacao indisponivel.' }, 502)

    const raw = await upstream.json()
    const hit = type === 'search' ? raw?.[0] : raw
    if (!hit?.display_name || !Number.isFinite(Number(hit.lat)) || !Number.isFinite(Number(hit.lon))) {
      return response({ error: 'Endereco nao encontrado.' }, 404)
    }

    const normalized = {
      display: hit.display_name,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    }
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const { error: cacheError } = await admin.from('geocoding_cache').upsert({
      cache_key: cacheKey,
      response: normalized,
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'cache_key' })
    if (cacheError) console.error('Falha ao atualizar cache:', cacheError.message)

    return response({ ...normalized, cached: false })
  } catch (error) {
    console.error(error)
    return response({ error: 'Falha interna na geocodificacao.' }, 500)
  }
})
