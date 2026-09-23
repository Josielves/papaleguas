import { useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Coordinate, Route } from '../types'

type LiveLocation = Coordinate & {
  recordedAt?: string | null
  accuracy?: number | null
  heading?: number | null
}

function toLocation(value: Record<string, unknown> | null | undefined): LiveLocation | null {
  if (!value) return null
  const latitude = Number(value.lat ?? value.latitude)
  const longitude = Number(value.lng ?? value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return {
    latitude,
    longitude,
    recordedAt: typeof value.recorded_at === 'string' ? value.recorded_at : null,
    accuracy: Number.isFinite(Number(value.accuracy_m)) ? Number(value.accuracy_m) : null,
    heading: Number.isFinite(Number(value.heading)) ? Number(value.heading) : null,
  }
}

export function useLiveRoute(route: Route) {
  const fallback = useMemo(() => toLocation({
    lat: route.driver_lat,
    lng: route.driver_lng,
    recorded_at: route.location_updated_at,
  }), [route.id, route.driver_lat, route.driver_lng, route.location_updated_at])
  const [location, setLocation] = useState<LiveLocation | null>(fallback)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocation(fallback)
    setError(null)
    if (!supabase || route.id.startsWith('demo-')) return

    let channel: RealtimeChannel | null = null
    let active = true

    supabase
      .from('route_locations')
      .select('lat,lng,accuracy_m,heading,recorded_at')
      .eq('route_id', route.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) setError('Localização temporariamente indisponível.')
        const next = toLocation(data as unknown as Record<string, unknown>)
        if (next) setLocation(next)
      })

    const update = (raw: Record<string, unknown>) => {
      const next = toLocation((raw.new ?? raw.record ?? raw) as Record<string, unknown>)
      if (!next) return
      setError(null)
      setLocation(next)
    }

    channel = supabase
      .channel(`route:${route.id}`, { config: { private: true } })
      .on('broadcast', { event: 'UPDATE' }, (payload) => update(payload.payload))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'route_locations', filter: `route_id=eq.${route.id}` },
        (payload) => update(payload as unknown as Record<string, unknown>),
      )
      .subscribe()

    return () => {
      active = false
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [route.id, fallback])

  const stale = location?.recordedAt
    ? Date.now() - new Date(location.recordedAt).getTime() > 2 * 60 * 1000
    : false

  return { location, stale, error }
}
