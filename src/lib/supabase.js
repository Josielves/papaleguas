import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const REGIONS = [
  { slug: 'centro', name: 'Centro' },
  { slug: 'norte', name: 'Norte' },
  { slug: 'sul', name: 'Sul' },
  { slug: 'leste', name: 'Leste' },
  { slug: 'oeste', name: 'Oeste' },
]

export function getRegionName(slug) {
  return REGIONS.find((r) => r.slug === slug)?.name ?? slug ?? ''
}

export function getPrice(originRegion, destinationRegion) {
  if (!originRegion || !destinationRegion || originRegion === destinationRegion) return 0
  return originRegion === 'centro' || destinationRegion === 'centro' ? 10 : 15
}

export function signIn({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUp({ email, password, name, accountType, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        account_type: accountType,
        phone,
      },
    },
  })
  if (error) return { data, error }

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name, account_type: accountType, phone })
      .eq('id', data.user.id)
    if (profileError) return { data, error: profileError }
  }

  return { data, error: null }
}

export async function getOpenRoutes(filters = {}) {
  let query = supabase
    .from('routes')
    .select(`
      *,
      driver:profiles!routes_driver_id_fkey(id, name, phone, avatar_url),
      seats(*)
    `)
    .eq('status', 'open')
    .gte('departure_time', new Date().toISOString())
    .order('departure_time', { ascending: true })
    .limit(100)

  if (filters.originRegion) query = query.eq('origin_region', filters.originRegion)
  if (filters.destinationRegion) query = query.eq('destination_region', filters.destinationRegion)

  return query
}

export function getDriverRoutes(driverId) {
  return supabase
    .from('routes')
    .select(`
      *,
      bookings(
        *,
        passenger:profiles!bookings_passenger_id_fkey(id, name, phone, avatar_url)
      )
    `)
    .eq('driver_id', driverId)
    .order('departure_time', { ascending: true })
    .limit(200)
}

export function getMyBookings(passengerId) {
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
    .limit(200)
}

export function createRoute(route) {
  return supabase.rpc('create_route_with_seats', {
    p_driver_id: route.driverId,
    p_origin_region: route.originRegion,
    p_destination_region: route.destinationRegion,
    p_origin_address: route.originAddress,
    p_destination_address: route.destinationAddress,
    p_origin_lat: route.originLat,
    p_origin_lng: route.originLng,
    p_destination_lat: route.destinationLat,
    p_destination_lng: route.destinationLng,
    p_departure_time: route.departureTime,
    p_total_seats: route.totalSeats,
    p_vehicle_model: route.vehicleModel,
    p_vehicle_plate: route.vehiclePlate,
    p_notes: route.notes,
  })
}

export function startRoute(routeId, driverId) {
  return supabase.rpc('start_route', {
    p_route_id: routeId,
    p_driver_id: driverId,
  })
}

export function cancelRoute(routeId) {
  return supabase
    .from('routes')
    .update({ status: 'cancelled' })
    .eq('id', routeId)
}

export function reserveSeat({ routeId, seatNumber, passengerId, pickupAddress, pickupLat, pickupLng }) {
  return supabase.rpc('reserve_seat', {
    p_route_id: routeId,
    p_seat_number: seatNumber,
    p_passenger_id: passengerId,
    p_pickup_address: pickupAddress || null,
    p_pickup_lat: pickupLat ?? null,
    p_pickup_lng: pickupLng ?? null,
  })
}

export function updateBookingRecipient(bookingId, { isForSomeoneElse, recipientName, recipientPhone }) {
  return supabase
    .from('bookings')
    .update({
      is_for_someone_else: Boolean(isForSomeoneElse),
      recipient_name: recipientName || null,
      recipient_phone: recipientPhone || null,
    })
    .eq('id', bookingId)
}

export function cancelBooking(bookingId, _seatId, _routeId, passengerId) {
  return supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_passenger_id: passengerId,
  })
}

export function updateDriverLocation(routeId, driverId, lat, lng) {
  return supabase.rpc('update_driver_location', {
    p_route_id: routeId,
    p_driver_id: driverId,
    p_lat: lat,
    p_lng: lng,
  })
}

export function subscribeToSeats(routeId, onChange) {
  return supabase
    .channel(`seats-${routeId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'seats', filter: `route_id=eq.${routeId}` },
      onChange
    )
    .subscribe()
}

export function subscribeToRoute(routeId, onChange) {
  return supabase
    .channel(`route-${routeId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'routes', filter: `id=eq.${routeId}` },
      onChange
    )
    .subscribe()
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização indisponível.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  })
}

export async function reverseGeocode(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', lat)
  url.searchParams.set('lon', lng)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao buscar endereço.')
  const data = await res.json()
  return data.display_name || `Localização atual (${lat.toFixed(4)}, ${lng.toFixed(4)})`
}

export async function geocodeAddress(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', address)
  const res = await fetch(url)
  if (!res.ok) return null
  const [hit] = await res.json()
  if (!hit) return null
  return {
    display: hit.display_name,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
  }
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v === null || v === undefined || Number.isNaN(Number(v)))) {
    return null
  }
  const toRad = (value) => (Number(value) * Math.PI) / 180
  const radius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function orderStops(origin, destination, bookings = []) {
  const originLat = origin?.lat ?? destination?.lat
  const originLng = origin?.lng ?? destination?.lng
  return [...bookings].sort((a, b) => {
    const da = distanceKm(originLat, originLng, a.pickup_lat, a.pickup_lng)
    const db = distanceKm(originLat, originLng, b.pickup_lat, b.pickup_lng)
    if (da === null) return 1
    if (db === null) return -1
    return da - db
  })
}

export function whatsAppLink(phone, message = '') {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${normalized}${text}`
}
