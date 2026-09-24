import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }

type VehicleType = 'car' | 'van'

type NormalizedVehicle = {
  plate: string
  brand: string | null
  model: string | null
  year: number | null
  modelYear: number | null
  color: string | null
  fuel: string | null
  city: string | null
  state: string | null
  type: VehicleType
  suggestedCapacity: number
  verifiedAt: string
}

function response(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  })
}

function normalizePlate(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

function validPlate(plate: string) {
  return /^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(plate)
}

function nullableText(value: unknown) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function nullableYear(value: unknown) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 1886 && year <= 2100 ? year : null
}

function inferVehicleType(raw: Record<string, unknown>, brand: string | null, model: string | null): VehicleType {
  const source = [
    raw.tipo,
    raw.tipoVeiculo,
    raw.segmento,
    raw.sub_segmento,
    raw.categoria,
    brand,
    model,
  ].filter(Boolean).join(' ').toUpperCase()

  return /\b(VAN|FURGAO|FURGÃO|MICRO[- ]?ONIBUS|MICRO[- ]?ÔNIBUS|SPRINTER|DUCATO|MASTER|BOXER|JUMPER|TRANSIT|DAILY)\b/.test(source)
    ? 'van'
    : 'car'
}

function normalizeProviderPayload(plate: string, payload: Record<string, unknown>): NormalizedVehicle {
  const nested = (payload.informacoes_veiculo ?? payload.data ?? payload) as Record<string, unknown>
  const brand = nullableText(nested.marca ?? nested.brand)
  const model = nullableText(nested.modelo ?? nested.model)
  const type = inferVehicleType(nested, brand, model)

  return {
    plate,
    brand,
    model,
    year: nullableYear(nested.anoFabricacao ?? nested.ano_fabricacao ?? nested.ano),
    modelYear: nullableYear(nested.anoModelo ?? nested.ano_modelo),
    color: nullableText(nested.cor ?? nested.color),
    fuel: nullableText(nested.combustivel ?? nested.fuel),
    city: nullableText(nested.municipio ?? nested.city),
    state: nullableText(nested.uf ?? nested.state),
    type,
    suggestedCapacity: type === 'van' ? 15 : 4,
    verifiedAt: new Date().toISOString(),
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function callProvider(provider: string, plate: string, token: string) {
  if (provider === 'placafipe') {
    const url = Deno.env.get('VEHICLE_LOOKUP_API_URL') ?? 'https://api.placafipe.com.br/getplaca'
    return fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa: plate, token }),
    })
  }

  const baseUrl = (Deno.env.get('VEHICLE_LOOKUP_API_URL') ?? 'https://api.fipeplaca.com.br/gateway/v1').replace(/\/$/, '')
  return fetch(`${baseUrl}/placa/${encodeURIComponent(plate)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Metodo nao permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const providerToken = Deno.env.get('VEHICLE_LOOKUP_API_TOKEN')
    const authorization = request.headers.get('Authorization') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return response({ error: 'Servico nao configurado.' }, 500)
    if (!authorization.startsWith('Bearer ')) return response({ error: 'Autenticacao obrigatoria.' }, 401)
    if (!providerToken) return response({ error: 'Consulta de placas ainda nao configurada.' }, 503)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const jwt = authorization.slice('Bearer '.length)
    const { data: authData, error: authError } = await admin.auth.getUser(jwt)
    if (authError || !authData.user) return response({ error: 'Sessao invalida.' }, 401)

    const body = await request.json()
    const plate = normalizePlate(body?.plate)
    if (!validPlate(plate)) {
      return response({ error: 'Informe uma placa antiga ou Mercosul valida.' }, 400)
    }

    const provider = (Deno.env.get('VEHICLE_LOOKUP_PROVIDER') ?? 'fipeplaca').toLowerCase()
    if (!['fipeplaca', 'placafipe'].includes(provider)) {
      return response({ error: 'Provedor de placas nao suportado.' }, 500)
    }

    const plateHash = await sha256(plate)
    const { data: cached } = await admin
      .from('vehicle_lookup_cache')
      .select('response')
      .eq('plate_hash', plateHash)
      .eq('provider', provider)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached?.response) return response({ ...cached.response, cached: true })

    const dailyLimit = Math.max(1, Math.min(100, Number(Deno.env.get('VEHICLE_LOOKUP_DAILY_LIMIT') ?? 20)))
    const { data: claimed, error: claimError } = await admin.rpc('claim_vehicle_lookup_request', {
      p_user_id: authData.user.id,
      p_daily_limit: dailyLimit,
    })
    if (claimError) throw claimError
    if (!claimed) {
      return response({ error: 'Limite diario de consultas atingido.' }, 429, { 'Retry-After': '86400' })
    }

    const upstream = await callProvider(provider, plate, providerToken)
    let raw: Record<string, unknown> = {}
    try {
      raw = await upstream.json()
    } catch {
      raw = {}
    }

    if (!upstream.ok) {
      if (upstream.status === 400) return response({ error: 'Placa invalida.' }, 400)
      if (upstream.status === 404) return response({ error: 'Placa nao encontrada.' }, 404)
      if ([401, 402, 403].includes(upstream.status)) {
        return response({ error: 'Servico de placas sem autorizacao ou saldo.' }, 503)
      }
      return response({ error: 'Servico de placas indisponivel. Tente novamente.' }, 502)
    }

    const normalized = normalizeProviderPayload(plate, raw)
    if (!normalized.brand && !normalized.model) {
      return response({ error: 'O provedor nao retornou dados para esta placa.' }, 404)
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const { error: cacheError } = await admin.from('vehicle_lookup_cache').upsert({
      plate_hash: plateHash,
      provider,
      response: normalized,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'plate_hash,provider' })
    if (cacheError) console.error('Falha ao atualizar cache de veiculo:', cacheError.message)

    return response({ ...normalized, cached: false })
  } catch (error) {
    console.error(error)
    return response({ error: 'Falha interna na consulta do veiculo.' }, 500)
  }
})
