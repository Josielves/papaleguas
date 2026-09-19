import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:2rem;height:2rem;border-radius:999px 999px 999px 4px;background:var(--amber-400,#a6e600);display:flex;align-items:center;justify-content:center;font-size:1rem;border:2px solid var(--cream-100,#10140a);box-shadow:0 4px 10px rgba(16,20,10,.25);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">📍</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

const FALLBACK_CENTER = [-24.9555, -53.4552] // Cascavel-PR, usado só até termos uma posição real

function Recenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15))
    }
  }, [lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickToMove({ onMove }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * LocationMap
 * Mapa compacto para escolher/confirmar um ponto (origem, destino ou
 * embarque). Mostra um marcador arrastável; tocar em qualquer lugar do
 * mapa também move o marcador para lá. Chama onChange(lat, lng) sempre
 * que o ponto muda — quem usa o componente decide o que fazer com isso
 * (ex: fazer reverse geocoding pra preencher o campo de endereço).
 *
 * Se lat/lng ainda não existem, mostra o mapa centralizado no fallback
 * sem marcador, esperando a localização atual ser obtida.
 */
export default function LocationMap({ lat, lng, onChange, height = '12rem' }) {
  const hasPoint = lat != null && lng != null
  const center = hasPoint ? [lat, lng] : FALLBACK_CENTER

  function handleDragEnd(e) {
    const { lat: newLat, lng: newLng } = e.target.getLatLng()
    onChange?.(newLat, newLng)
  }

  return (
    <div style={{ height, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--line-700)' }}>
      <MapContainer
        center={center}
        zoom={hasPoint ? 15 : 12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPoint && (
          <Marker
            position={[lat, lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
          />
        )}
        <ClickToMove onMove={(la, ln) => onChange?.(la, ln)} />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  )
}
