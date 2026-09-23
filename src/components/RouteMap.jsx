import { Fragment, useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getRegionName } from '../lib/supabase'
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '../lib/mapConfig'

const REGION_POINTS = {
  centro: [-24.9555, -53.4552],
  norte: [-24.925, -53.455],
  sul: [-24.992, -53.462],
  leste: [-24.958, -53.41],
  oeste: [-24.958, -53.505],
}

function routePoint(route, type) {
  const lat = type === 'origin' ? route.origin_lat : route.destination_lat
  const lng = type === 'origin' ? route.origin_lng : route.destination_lng
  if (lat && lng) return [lat, lng]
  return REGION_POINTS[type === 'origin' ? route.origin_region : route.destination_region] ?? null
}

function FitMap({ points }) {
  const map = useMap()
  const pointsKey = JSON.stringify(points)

  useEffect(() => {
    const valid = points.filter(Boolean)
    const container = map.getContainer()
    let frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false })
      if (valid.length > 1) map.fitBounds(valid, { padding: [28, 28] })
      else if (valid.length === 1) map.setView(valid[0], 13)
    })

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    })
    observer.observe(container)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [map, pointsKey])

  return null
}

export default function RouteMap({ routes = [], myLocation, showHeader = true }) {
  const mapRoutes = useMemo(
    () => routes
      .map((route) => ({
        route,
        origin: routePoint(route, 'origin'),
        destination: routePoint(route, 'destination'),
      }))
      .filter((item) => item.origin && item.destination),
    [routes]
  )

  const points = [
    ...mapRoutes.flatMap((item) => [item.origin, item.destination]),
    myLocation ? [myLocation.lat, myLocation.lng] : null,
  ]

  return (
    <section className={`route-map-shell ${showHeader ? '' : 'route-map-shell--compact'}`} aria-label="Mapa de rotas abertas">
      {showHeader && (
        <div className="route-map-shell__header">
          <div>
            <p className="eyebrow">Mapa vivo</p>
            <h3>Rotas se movendo pela cidade</h3>
          </div>
          <span className="live-chip"><span /> {routes.length} abertas</span>
        </div>
      )}
      <MapContainer
        center={REGION_POINTS.centro}
        zoom={12}
        scrollWheelZoom={false}
        className="route-map"
      >
        <TileLayer
          attribution={MAP_ATTRIBUTION}
          url={MAP_TILE_URL}
        />
        {mapRoutes.map(({ route, origin, destination }) => (
          <Fragment key={route.id}>
            <Polyline positions={[origin, destination]} pathOptions={{ color: '#f5a623', weight: 5, opacity: 0.8, dashArray: '10 12' }} />
            <CircleMarker center={origin} radius={8} pathOptions={{ color: '#2dd9b5', fillColor: '#2dd9b5', fillOpacity: 0.95 }}>
              <Popup>{getRegionName(route.origin_region)}</Popup>
            </CircleMarker>
            <CircleMarker center={destination} radius={8} pathOptions={{ color: '#ff6b5b', fillColor: '#ff6b5b', fillOpacity: 0.95 }}>
              <Popup>
                {getRegionName(route.destination_region)}
                {route.available_seats ? ` - ${route.available_seats} assentos` : ''}
              </Popup>
            </CircleMarker>
          </Fragment>
        ))}
        {myLocation && (
          <CircleMarker center={[myLocation.lat, myLocation.lng]} radius={10} pathOptions={{ color: '#ffffff', fillColor: '#2dd9b5', fillOpacity: 0.9 }}>
            <Popup>Voce esta aqui</Popup>
          </CircleMarker>
        )}
        <FitMap points={points} />
      </MapContainer>
    </section>
  )
}
