import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { subscribeToRoute, supabase, distanceKm } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'

const icon = (emoji, bg) =>
  L.divIcon({
    className: '',
    html: `<div style="width:2.25rem;height:2.25rem;border-radius:999px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:1.125rem;border:2px solid var(--ink-950,#0b1120);box-shadow:0 4px 10px rgba(0,0,0,.4)">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })

const driverIcon = icon('🚗', 'var(--amber-500, #f5a623)')
const pickupIcon = icon('📍', 'var(--teal-400, #2dd9b5)')
const destIcon = icon('🏁', 'var(--coral-500, #ff6b5b)')

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    const valid = points.filter(Boolean)
    if (valid.length === 0) return
    if (valid.length === 1) {
      map.setView(valid[0], 14)
    } else {
      map.fitBounds(valid, { padding: [40, 40] })
    }
  }, [JSON.stringify(points)])
  return null
}

export default function LiveTrackingMap({ route, pickup }) {
  const [live, setLive] = useState({
    lat: route.driver_lat,
    lng: route.driver_lng,
    updatedAt: route.location_updated_at,
  })

  useEffect(() => {
    const channel = subscribeToRoute(route.id, (payload) => {
      setLive({
        lat: payload.new.driver_lat,
        lng: payload.new.driver_lng,
        updatedAt: payload.new.location_updated_at,
      })
    })
    return () => supabase.removeChannel(channel)
  }, [route.id])

  const driverPos = live.lat && live.lng ? [live.lat, live.lng] : null
  const pickupPos = pickup?.pickup_lat && pickup?.pickup_lng ? [pickup.pickup_lat, pickup.pickup_lng] : null
  const destPos = route.destination_lat && route.destination_lng ? [route.destination_lat, route.destination_lng] : null

  const center = driverPos ?? pickupPos ?? destPos ?? [-24.9555, -53.4552] // fallback: Cascavel-PR

  const distToPickup = driverPos && pickupPos ? distanceKm(driverPos[0], driverPos[1], pickupPos[0], pickupPos[1]) : null

  const stale = live.updatedAt && (Date.now() - new Date(live.updatedAt).getTime()) > 2 * 60 * 1000

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
        </div>
      )}

      <div style={{ height: '20rem', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--line-700)' }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
          <FitBounds points={[driverPos, pickupPos, destPos]} />
        </MapContainer>
      </div>
    </div>
  )
}
