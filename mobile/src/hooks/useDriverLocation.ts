import { useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'

const SEND_INTERVAL_MS = 8000

export function useDriverLocation(routeId: string | null, driverId: string, enabled: boolean) {
  const [error, setError] = useState<string | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)
  const lastSent = useRef(0)
  const sending = useRef(false)

  useEffect(() => {
    if (!enabled || !routeId || !supabase || routeId.startsWith('demo-')) {
      setBroadcasting(enabled && Boolean(routeId))
      return
    }
    const client = supabase

    let subscription: Location.LocationSubscription | null = null
    let active = true

    const start = async () => {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!active) return
      if (permission.status !== 'granted') {
        setError('Ative a localização para iniciar o acompanhamento da rota.')
        return
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 8,
        },
        async ({ coords, timestamp }) => {
          if (timestamp - lastSent.current < SEND_INTERVAL_MS || sending.current) return
          lastSent.current = timestamp
          sending.current = true
          const { error: updateError } = await client.rpc('update_driver_location', {
            p_route_id: routeId,
            p_driver_id: driverId,
            p_lat: coords.latitude,
            p_lng: coords.longitude,
            p_accuracy_m: coords.accuracy,
            p_heading: coords.heading,
            p_speed_mps: coords.speed,
          })
          sending.current = false
          if (updateError) setError('Falha ao enviar a localização. Tentaremos novamente.')
          else {
            setError(null)
            setBroadcasting(true)
          }
        },
      )
    }

    void start().catch(() => setError('Não foi possível iniciar a localização.'))
    return () => {
      active = false
      subscription?.remove()
      setBroadcasting(false)
    }
  }, [routeId, driverId, enabled])

  return { broadcasting, error }
}
