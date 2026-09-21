import { useCallback, useRef, useState } from 'react'
import { updateDriverLocation } from './supabase'

const configuredInterval = Number(import.meta.env.VITE_LOCATION_INTERVAL_MS)
const MIN_INTERVAL_MS = Number.isFinite(configuredInterval)
  ? Math.max(5000, configuredInterval)
  : 10000

export function useLocationBroadcast() {
  const [activeRouteId, setActiveRouteId] = useState(null)
  const watchIdRef = useRef(null)
  const lastSentRef = useRef(0)
  const inFlightRef = useRef(false)

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
        if (now - lastSentRef.current < MIN_INTERVAL_MS || inFlightRef.current) return
        lastSentRef.current = now
        inFlightRef.current = true
        Promise.resolve(
          updateDriverLocation(routeId, driverId, pos.coords.latitude, pos.coords.longitude, {
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          })
        ).finally(() => {
          inFlightRef.current = false
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }, [stop])

  return { activeRouteId, start, stop }
}
