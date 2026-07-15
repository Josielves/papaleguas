import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Regiões ──────────────────────────────────────────────────
export const REGIONS = [
  { slug: 'centro', name: 'Centro',  isCenter: true  },
  { slug: 'norte',  name: 'Norte',   isCenter: false },
  { slug: 'sul',    name: 'Sul',     isCenter: false },
  { slug: 'leste',  name: 'Leste',   isCenter: false },
  { slug: 'oeste',  name: 'Oeste',   isCenter: false },
]

export function getPrice(originSlug, destinationSlug) {
  if (originSlug === destinationSlug) return 0
  if (originSlug === 'centro' || destinationSlug === 'centro') return 10
  return 15
}

export function getRegionName(slug) {
  return REGIONS.find(r => r.slug === slug)?.name ?? slug
}

// ── Auth ──────────────────────────────────────────────────────
export async function signUp({ email, password, name, accountType }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, account_type: accountType } },
  })
  return { data, error }
}

export async function signIn({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getProfile(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

// ── Rotas ─────────────────────────────────────────────────────
export async function createRoute(params) {
  return supabase.rpc('create_route_with_seats', {
    p_driver_id:           params.driverId,
    p_origin_region:       params.originRegion,
    p_destination_region:  params.destinationRegion,
    p_origin_address:      params.originAddress,
    p_destination_address: params.destinationAddress,
    p_origin_lat:          params.originLat,
    p_origin_lng:          params.originLng,
    p_destination_lat:     params.destinationLat,
    p_destination_lng:     params.destinationLng,
    p_departure_time:      params.departureTime,
    p_total_seats:         params.totalSeats,
    p_vehicle_model:       params.vehicleModel,
    p_vehicle_plate:       params.vehiclePlate,
    p_notes:               params.notes,
  })
}

export async function getOpenRoutes(filters = {}) {
  let query = supabase
    .from('routes')
    .select(`
      *,
      driver:profiles!routes_driver_id_fkey(id, name, phone, avatar_url),
      seats(id, seat_number, status, passenger_id)
    `)
    .in('status', ['open', 'full'])
    .gte('departure_time', new Date().toISOString())
    .order('departure_time', { ascending: true })

  if (filters.originRegion)      query = query.eq('origin_region', filters.originRegion)
  if (filters.destinationRegion) query = query.eq('destination_region', filters.destinationRegion)

  return query
}

export async function getDriverRoutes(driverId) {
  return supabase
    .from('routes')
    .select(`
      *,
      seats(id, seat_number, status, passenger_id),
      bookings(id, passenger_id, seat_number, status, pickup_address,
        passenger:profiles!bookings_passenger_id_fkey(id, name, phone))
    `)
    .eq('driver_id', driverId)
    .order('departure_time', { ascending: false })
}

export async function cancelRoute(routeId) {
  return supabase
    .from('routes')
    .update({ status: 'cancelled' })
    .eq('id', routeId)
}

export async function startRoute(routeId, driverId) {
  // Só a partir desse momento a rota aparece para os passageiros e pode
  // receber reservas — reserve_seat bloqueia rotas com status 'scheduled'.
  return supabase.rpc('start_route', {
    p_route_id: routeId,
    p_driver_id: driverId,
  })
}

// ── Reservas ──────────────────────────────────────────────────
export async function reserveSeat({ routeId, seatNumber, passengerId, pickupAddress, pickupLat, pickupLng }) {
  return supabase.rpc('reserve_seat', {
    p_route_id:       routeId,
    p_seat_number:    seatNumber || 0,
    p_passenger_id:   passengerId,
    p_pickup_address: pickupAddress || null,
    p_pickup_lat:     pickupLat    || null,
    p_pickup_lng:     pickupLng    || null,
  })
}

export async function getMyBookings(passengerId) {
  return supabase
    .from('bookings')
    .select(`
      *,
      route:routes(
        *,
        driver:profiles!routes_driver_id_fkey(id, name, phone, avatar_url)
      )
    `)
    .eq('passenger_id', passengerId)
    .order('created_at', { ascending: false })
}

export async function cancelBooking(bookingId, seatId, routeId, passengerId) {
  // Cancela reserva, libera assento e reabre a rota — tudo numa transação
  // atômica via RPC (evita condições de corrida e políticas de RLS amplas).
  return supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_passenger_id: passengerId,
  })
}

// ── Mensagens / Chat ─────────────────────────────────────────
export async function getMessages(bookingId) {
  return supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, name, avatar_url)
    `)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
}

export async function sendMessage({ bookingId, routeId, senderId, content }) {
  return supabase.from('messages').insert({
    booking_id: bookingId,
    route_id:   routeId,
    sender_id:  senderId,
    content,
  })
}

export function subscribeToMessages(bookingId, callback) {
  return supabase
    .channel(`messages:${bookingId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `booking_id=eq.${bookingId}`,
    }, callback)
    .subscribe()
}

export function subscribeToSeats(routeId, callback) {
  return supabase
    .channel(`seats:${routeId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'seats',
      filter: `route_id=eq.${routeId}`,
    }, callback)
    .subscribe()
}

// ── Geolocalização ────────────────────────────────────────────
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    )
    const data = await res.json()
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

export async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    )
    const data = await res.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
    }
    return null
  } catch {
    return null
  }
}

// ── Distância (proximidade) ────────────────────────────────────
// Fórmula de Haversine — distância em km entre dois pontos por lat/lng.
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v === null || v === undefined)) return null
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
