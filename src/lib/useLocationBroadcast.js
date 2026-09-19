import { useCallback, useRef, useState } from 'react'
import { updateDriverLocation } from './supabase'

const MIN_INTERVAL_MS = 8000

export function useLocationBroadcast() {
  const [activeRouteId, setActiveRouteId] = useState(null)
  const watchIdRef = useRef(null)
  const lastSentRef = useRef(0)

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setActiveRouteId(null)
  }, [])

  const start = useCallback((routeId, driverId) => {
    if (!navigator.geolocation) return
    stop()
    setActiveRouteId(routeId)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < MIN_INTERVAL_MS) return
        lastSentRef.current = now
        updateDriverLocation(routeId, driverId, pos.coords.latitude, pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }, [stop])

  return { activeRouteId, start, stop }
}
