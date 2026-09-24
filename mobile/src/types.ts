export type AppRole = 'passenger' | 'driver'

export type Profile = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  avatar_url?: string | null
  account_type?: AppRole
  vehicle_brand?: string | null
  vehicle_model?: string | null
  vehicle_plate?: string | null
  vehicle_color?: string | null
  vehicle_year?: number | null
  vehicle_model_year?: number | null
  vehicle_type?: 'car' | 'van' | null
  vehicle_capacity?: number | null
  vehicle_lookup_verified_at?: string | null
}

export type Seat = {
  id: string
  seat_number: number
  status: 'available' | 'reserved' | 'occupied'
}

export type Driver = {
  id: string
  name: string
  phone?: string | null
  avatar_url?: string | null
}

export type Booking = {
  id: string
  status: string
  amount?: number | null
  passenger?: Profile | null
}

export type Route = {
  id: string
  driver_id: string
  origin_region?: string | null
  destination_region?: string | null
  origin_address: string
  destination_address: string
  origin_lat?: number | null
  origin_lng?: number | null
  destination_lat?: number | null
  destination_lng?: number | null
  driver_lat?: number | null
  driver_lng?: number | null
  location_updated_at?: string | null
  started_at?: string | null
  departure_time: string
  total_seats: number
  available_seats?: number | null
  price?: number | null
  status: string
  vehicle_model?: string | null
  vehicle_plate?: string | null
  vehicle_brand?: string | null
  vehicle_color?: string | null
  vehicle_year?: number | null
  vehicle_model_year?: number | null
  vehicle_type?: 'car' | 'van' | null
  vehicle_capacity?: number | null
  driver?: Driver | null
  seats?: Seat[]
  bookings?: Booking[]
}

export type AppNotification = {
  id: string
  title: string
  message: string
  created_at: string
  read_at?: string | null
  route_id?: string | null
  data?: Record<string, unknown> | null
}

export type Coordinate = {
  latitude: number
  longitude: number
}
