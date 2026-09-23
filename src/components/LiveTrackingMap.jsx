import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getRouteLocation, subscribeToRouteLocation, supabase, distanceKm } from '../lib/supabase'
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '../lib/mapConfig'
import 'leaflet/dist/leaflet.css'

const icon = (emoji, bg) =>
  L.divIcon({
    className: '',
    html: `<div style="width:2.25rem;height:2.25rem;border-radius:999px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:1.125rem;border:2px solid #fff;box-shadow:0 5px 14px rgba(15,23,42,.24)">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })

const driverIcon = icon('🚗', 'var(--amber-500, #f5a623)')
const pickupIcon = icon('📍', 'var(--teal-400, #2dd9b5)')
const destIcon = icon('🏁', 'var(--coral-500, #ff6b5b)')

function normalizePosition(lat, lng) {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return [latitude, longitude]
}

function StableViewport({ points, resetKey, fitRequest }) {
  const map = useMap()
  const fittedRef = useRef(false)
  const handledRequestRef = useRef(0)

  useEffect(() => {
    fittedRef.current = false
    handledRequestRef.current = fitRequest
  }, [resetKey])

  useEffect(() => {
    const valid = points.filter(Boolean)
    if (valid.length === 0) return
    if (fittedRef.current && handledRequestRef.current === fitRequest) return
    if (valid.length === 1) {
      map.flyTo(valid[0], 14, { duration: 0.45 })
    } else {
      map.fitBounds(valid, { padding: [42, 42], maxZoom: 15, animate: true, duration: 0.45 })
    }
    fittedRef.current = true
    handledRequestRef.current = fitRequest
  }, [map, fitRequest, resetKey, points])

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ pan: false })
    map.whenReady(invalidate)
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(invalidate)
    observer?.observe(map.getContainer())
    return () => observer?.disconnect()
  }, [map])

  return null
}

export default function LiveTrackingMap({ route, pickup }) {
  const [live, setLive] = useState({
    lat: route.driver_lat,
    lng: route.driver_lng,
    updatedAt: route.location_updated_at,
  })
  const [fitRequest, setFitRequest] = useState(0)
  const [trackingError, setTrackingError] = useState('')

  useEffect(() => {
    let mounted = true
    getRouteLocation(route.id).then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setTrackingError('Não foi possível carregar a posição do motorista.')
        return
      }
      if (!data || !normalizePosition(data.lat, data.lng)) return
      setTrackingError('')
      setLive({ lat: data.lat, lng: data.lng, updatedAt: data.recorded_at })
    })

    const channel = subscribeToRouteLocation(route.id, (payload) => {
      const next = payload.new
      if (!next || !normalizePosition(next.lat, next.lng)) return
      setTrackingError('')
      setLive({
        lat: next.lat,
        lng: next.lng,
        updatedAt: next.recorded_at,
      })
    })
    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [route.id])

  const driverPos = normalizePosition(live.lat, live.lng)
  const pickupPos = normalizePosition(pickup?.pickup_lat, pickup?.pickup_lng)
  const destPos = normalizePosition(route.destination_lat, route.destination_lng)
  const points = useMemo(
    () => [driverPos, pickupPos, destPos],
    [driverPos?.[0], driverPos?.[1], pickupPos?.[0], pickupPos?.[1], destPos?.[0], destPos?.[1]],
  )

  const center = driverPos ?? pickupPos ?? destPos ?? [-24.9555, -53.4552] // fallback: Cascavel-PR

  const distToPickup = driverPos && pickupPos ? distanceKm(driverPos[0], driverPos[1], pickupPos[0], pickupPos[1]) : null

  const updatedAtMs = live.updatedAt ? new Date(live.updatedAt).getTime() : null
  const stale = Number.isFinite(updatedAtMs) && (Date.now() - updatedAtMs) > 2 * 60 * 1000

  return (
    <div>
      {!driverPos && (
        <div className="empty-state" style={{ padding: '1.5rem', marginBottom: '0.875rem' }}>
          <p>O motorista ainda não começou a transmitir a localização.</p>
        </div>
      )}

      {driverPos && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
          {distToPickup !== null && (
            <span className="tag">🚗 {distToPickup < 1 ? `${Math.round(distToPickup * 1000)} m` : `${distToPickup.toFixed(1)} km`} do embarque</span>
          )}
          {stale && <span className="tag" style={{ color: 'var(--coral-400)' }}>⚠ Sinal desatualizado</span>}
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setFitRequest(value => value + 1)}>
            Reenquadrar mapa
          </button>
        </div>
      )}

      {trackingError && <p className="field-error" role="status">{trackingError}</p>}

      <div style={{ height: '20rem', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--line-700)' }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer
            attribution={MAP_ATTRIBUTION}
            url={MAP_TILE_URL}
          />
          {driverPos && (
            <Marker position={driverPos} icon={driverIcon}>
              <Popup>Motorista</Popup>
            </Marker>
          )}
          {pickupPos && (
            <Marker position={pickupPos} icon={pickupIcon}>
              <Popup>Seu embarque</Popup>
            </Marker>
          )}
          {destPos && (
            <Marker position={destPos} icon={destIcon}>
              <Popup>Destino final</Popup>
            </Marker>
          )}
          {points.filter(Boolean).length > 1 && (
            <Polyline positions={points.filter(Boolean)} pathOptions={{ color: '#0f9f93', weight: 4, opacity: 0.75 }} />
          )}
          <StableViewport
            points={points}
            fitRequest={fitRequest}
            resetKey={`${route.id}:${pickupPos?.join(',') ?? ''}:${destPos?.join(',') ?? ''}`}
          />
        </MapContainer>
      </div>
    </div>
  )
}
