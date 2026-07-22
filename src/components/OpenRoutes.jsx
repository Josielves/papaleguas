import { useEffect, useState } from 'react'
import { getOpenRoutes, REGIONS, getCurrentPosition, distanceKm } from '../lib/supabase'
import RouteCard from './RouteCard'
import Modal from './Modal'
import SeatPicker from './SeatPicker'

export default function OpenRoutes({ user, onError, onSuccess }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ originRegion: '', destinationRegion: '' })
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [sortByDistance, setSortByDistance] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await getOpenRoutes(filters)
    if (error) onError?.('Não foi possível carregar as rotas.')
    setRoutes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filters.originRegion, filters.destinationRegion])

  async function findNearMe() {
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      setMyLocation(pos)
      setSortByDistance(true)
    } catch {
      onError?.('Não foi possível obter sua localização.')
    } finally {
      setLocating(false)
    }
  }

  let visibleRoutes = routes.filter(r => r.driver_id !== user.id)

  if (sortByDistance && myLocation) {
    visibleRoutes = visibleRoutes
      .map(r => ({ ...r, _distance: distanceKm(myLocation.lat, myLocation.lng, r.origin_lat, r.origin_lng) }))
      .sort((a, b) => {
        if (a._distance === null) return 1
        if (b._distance === null) return -1
        return a._distance - b._distance
      })
  }

  return (
    <div className="page-container">
      <div className="section-heading">
        <div>
          <h2>Rotas abertas</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Encontre uma carona para sua região</p>
        </div>
        <button className="btn btn-secondary" onClick={findNearMe} disabled={locating}>
          {locating ? 'Localizando…' : sortByDistance ? '📍 Mais próximas primeiro' : '📍 Perto de mim'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.75rem' }}>
        <div>
          <label className="field-label" htmlFor="filterOrigin">Origem</label>
          <select
            id="filterOrigin"
            className="select"
            value={filters.originRegion}
            onChange={(e) => setFilters(f => ({ ...f, originRegion: e.target.value }))}
          >
            <option value="">Todas</option>
            {REGIONS.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="filterDest">Destino</label>
          <select
            id="filterDest"
            className="select"
            value={filters.destinationRegion}
            onChange={(e) => setFilters(f => ({ ...f, destinationRegion: e.target.value }))}
          >
            <option value="">Todas</option>
            {REGIONS.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '11rem', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      )}

      {!loading && visibleRoutes.length === 0 && (
        <div className="empty-state">
          <h3 style={{ marginBottom: '0.5rem' }}>Nenhuma rota encontrada</h3>
          <p>Tente ajustar os filtros ou volte mais tarde.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))', gap: '1rem' }}>
        {visibleRoutes.map(route => (
          <RouteCard key={route.id} route={route} onReserve={setSelectedRoute} distanceKm={route._distance} />
        ))}
      </div>

      {selectedRoute && (
        <Modal title="Reservar assento" onClose={() => setSelectedRoute(null)}>
          <SeatPicker
            route={selectedRoute}
            user={user}
            onDone={() => { setSelectedRoute(null); load() }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </Modal>
      )}
    </div>
  )
}
