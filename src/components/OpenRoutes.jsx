import { useEffect, useState } from 'react'
import { ArrowUpDown, LocateFixed, Map, Search } from 'lucide-react'
import { getOpenRoutes, REGIONS, getCurrentPosition, distanceKm } from '../lib/supabase'
import RouteCard from './RouteCard'
import Modal from './Modal'
import SeatPicker from './SeatPicker'
import RouteMap from './RouteMap'
import RouteDetails from './RouteDetails'
import WaitlistPanel from './WaitlistPanel'

export default function OpenRoutes({ user, onError, onSuccess }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ originRegion: '', destinationRegion: '' })
  const [draftFilters, setDraftFilters] = useState({ originRegion: '', destinationRegion: '' })
  const [detailRoute, setDetailRoute] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [waitlistRoute, setWaitlistRoute] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [sortByDistance, setSortByDistance] = useState(false)
  const [showMap, setShowMap] = useState(false)

  async function load(nextFilters = filters) {
    setLoading(true)
    const { data, error } = await getOpenRoutes(nextFilters)
    if (error) onError?.('Não foi possível carregar as rotas.')
    setRoutes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load({ originRegion: '', destinationRegion: '' }) }, [])

  function handleSearch(event) {
    event.preventDefault()
    if (
      draftFilters.originRegion &&
      draftFilters.destinationRegion &&
      draftFilters.originRegion === draftFilters.destinationRegion
    ) {
      onError?.('Origem e destino precisam ser diferentes.')
      return
    }
    setFilters(draftFilters)
    load(draftFilters)
  }

  function swapRegions() {
    setDraftFilters(current => ({
      originRegion: current.destinationRegion,
      destinationRegion: current.originRegion,
    }))
  }

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
    <main className="page-container passenger-home">
      <section className="passenger-search" aria-labelledby="passenger-search-title">
        <form className="passenger-search__form" onSubmit={handleSearch}>
          <div className="passenger-search__heading">
            <p className="eyebrow">Sua próxima viagem</p>
            <h1 id="passenger-search-title">Para onde você vai?</h1>
          </div>

          <div className="route-search-fields">
            <label className="route-search-field" htmlFor="filterOrigin">
              <span className="route-search-field__marker route-search-field__marker--origin" aria-hidden="true" />
              <span className="route-search-field__copy">
                <small>Origem</small>
                <select
                  id="filterOrigin"
                  value={draftFilters.originRegion}
                  onChange={(event) => setDraftFilters(current => ({ ...current, originRegion: event.target.value }))}
                >
                  <option value="">Todas as regiões</option>
                  {REGIONS.map(region => <option key={region.slug} value={region.slug}>{region.name}</option>)}
                </select>
              </span>
            </label>

            <button
              type="button"
              className="route-search-swap"
              onClick={swapRegions}
              aria-label="Inverter origem e destino"
              title="Inverter origem e destino"
            >
              <ArrowUpDown size={18} aria-hidden="true" />
            </button>

            <label className="route-search-field" htmlFor="filterDest">
              <span className="route-search-field__marker route-search-field__marker--destination" aria-hidden="true" />
              <span className="route-search-field__copy">
                <small>Destino</small>
                <select
                  id="filterDest"
                  value={draftFilters.destinationRegion}
                  onChange={(event) => setDraftFilters(current => ({ ...current, destinationRegion: event.target.value }))}
                >
                  <option value="">Todas as regiões</option>
                  {REGIONS.map(region => <option key={region.slug} value={region.slug}>{region.name}</option>)}
                </select>
              </span>
            </label>
          </div>

          <div className="passenger-search__actions">
            <button className="btn passenger-search__submit" type="submit" disabled={loading}>
              <Search size={18} aria-hidden="true" />
              {loading ? 'Procurando...' : 'Procurar rotas'}
            </button>
            <button className="nearby-button" type="button" onClick={findNearMe} disabled={locating}>
              <LocateFixed size={18} aria-hidden="true" />
              {locating ? 'Localizando...' : sortByDistance ? 'Ordenadas por distância' : 'Usar minha localização'}
            </button>
          </div>
        </form>

        <div className={`passenger-search__map ${showMap ? 'is-visible' : ''}`}>
          <RouteMap routes={visibleRoutes} myLocation={myLocation} showHeader={false} />
        </div>

        <button
          className="map-toggle"
          type="button"
          onClick={() => setShowMap(current => !current)}
          aria-expanded={showMap}
        >
          <Map size={18} aria-hidden="true" />
          {showMap ? 'Ocultar mapa' : 'Ver rotas no mapa'}
        </button>
      </section>

      <section className="upcoming-routes" aria-labelledby="upcoming-routes-title">
        <div className="upcoming-routes__heading">
          <div>
            <p className="eyebrow">Agenda aberta</p>
            <h2 id="upcoming-routes-title">Próximas viagens</h2>
          </div>
          {!loading && <span>{visibleRoutes.length} {visibleRoutes.length === 1 ? 'rota' : 'rotas'}</span>}
        </div>

        {loading && (
          <div className="compact-route-list" aria-label="Carregando rotas">
            {[1, 2, 3].map(item => <div key={item} className="skeleton compact-route-skeleton" />)}
          </div>
        )}

        {!loading && visibleRoutes.length === 0 && (
          <div className="empty-state">
            <h3 style={{ marginBottom: '0.5rem' }}>Nenhuma rota encontrada</h3>
            <p>Tente ajustar a origem ou o destino.</p>
          </div>
        )}

        <div className="compact-route-list">
          {visibleRoutes.map(route => (
            <RouteCard
              compact
              key={route.id}
              route={route}
              onReserve={setDetailRoute}
              onWaitlist={setDetailRoute}
              distanceKm={route._distance}
            />
          ))}
        </div>
      </section>

      {detailRoute && (
        <Modal
          title="Procurar viagem"
          variant="route-detail"
          navigation="back"
          onClose={() => setDetailRoute(null)}
        >
          <RouteDetails
            route={detailRoute}
            onReserve={(route) => {
              setDetailRoute(null)
              setSelectedRoute(route)
            }}
            onWaitlist={(route) => {
              setDetailRoute(null)
              setWaitlistRoute(route)
            }}
          />
        </Modal>
      )}

      {selectedRoute && (
        <Modal
          title="Escolher assento"
          variant="seat-picker"
          navigation="back"
          onClose={() => {
            setDetailRoute(selectedRoute)
            setSelectedRoute(null)
          }}
        >
          <SeatPicker
            route={selectedRoute}
            user={user}
            onDone={() => { setSelectedRoute(null); setDetailRoute(null); load() }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </Modal>
      )}

      {waitlistRoute && (
        <Modal title="Lista de espera" onClose={() => setWaitlistRoute(null)}>
          <WaitlistPanel
            route={waitlistRoute}
            user={user}
            onDone={() => { setWaitlistRoute(null); load() }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </Modal>
      )}
    </main>
  )
}
