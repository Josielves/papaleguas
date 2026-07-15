import { useEffect, useState } from 'react'
import { getDriverRoutes, cancelRoute, startRoute, getRegionName, orderStops, whatsAppLink, getPrice } from '../lib/supabase'
import { formatDateTime, formatPrice, initials } from '../lib/format'
import { useLocationBroadcast } from '../lib/useLocationBroadcast'
import Modal from './Modal'
import Chat from './Chat'
import CreateRoute from './CreateRoute'

export default function DriverDashboard({ user, onError, onSuccess }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeChat, setActiveChat] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [starting, setStarting] = useState(null)
  const { activeRouteId, start: startBroadcast, stop: stopBroadcast } = useLocationBroadcast()

  async function load() {
    setLoading(true)
    const { data, error } = await getDriverRoutes(user.id)
    if (error) onError?.('Não foi possível carregar suas rotas.')
    setRoutes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])
  useEffect(() => () => stopBroadcast(), [stopBroadcast])

  async function handleCancel(routeId) {
    setCancelling(routeId)
    const { error } = await cancelRoute(routeId)
    if (error) onError?.('Não foi possível cancelar a rota.')
    else {
      if (activeRouteId === routeId) stopBroadcast()
      onSuccess?.('Rota cancelada.')
      load()
    }
    setCancelling(null)
  }

  async function handleStart(routeId) {
    setStarting(routeId)
    const { error } = await startRoute(routeId, user.id)
    if (error) onError?.('Não foi possível iniciar a rota.')
    else {
      onSuccess?.('Rota iniciada! Já está visível para passageiros próximos. 🚗')
      startBroadcast(routeId, user.id)
      load()
    }
    setStarting(null)
  }

  function toggleBroadcast(routeId) {
    if (activeRouteId === routeId) {
      stopBroadcast()
      onSuccess?.('Localização parou de ser compartilhada.')
    } else {
      startBroadcast(routeId, user.id)
      onSuccess?.('Compartilhando sua localização em tempo real. 📡')
    }
  }

  const activeRoutes = routes.filter(r => r.status !== 'cancelled')
  const totalPassengers = routes.reduce((acc, r) => acc + (r.bookings?.filter(b => b.status !== 'cancelled').length ?? 0), 0)
  const totalEarnings = routes.reduce((acc, r) => {
    const confirmed = r.bookings?.filter(b => b.status !== 'cancelled').length ?? 0
    return acc + confirmed * getPrice(r.origin_region, r.destination_region)
  }, 0)

  return (
    <div className="page-container">
      <div className="section-heading">
        <div>
          <h2>Painel do motorista</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Gerencie suas rotas e passageiros</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Nova rota</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.875rem', marginBottom: '2rem' }}>
        <div className="stat-tile">
          <div className="stat-tile__value">{activeRoutes.length}</div>
          <div className="stat-tile__label">Rotas ativas</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__value">{totalPassengers}</div>
          <div className="stat-tile__label">Passageiros</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__value">{formatPrice(totalEarnings)}</div>
          <div className="stat-tile__label">Total estimado</div>
        </div>
      </div>

      {loading && <SkeletonList />}

      {!loading && routes.length === 0 && (
        <div className="empty-state">
          <h3 style={{ marginBottom: '0.5rem' }}>Nenhuma rota criada ainda</h3>
          <p style={{ marginBottom: '1.25rem' }}>Publique sua primeira rota e comece a levar passageiros.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Criar rota</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {routes.map(route => {
          const activeBookings = route.bookings?.filter(b => b.status !== 'cancelled') ?? []
          const stops = orderStops(
            { lat: route.origin_lat, lng: route.origin_lng },
            { lat: route.destination_lat, lng: route.destination_lng },
            activeBookings
          )
          const isBroadcasting = activeRouteId === route.id

          return (
            <div className="route-card" key={route.id}>
              <div className="route-card__top" />
              <div className="route-card__body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div className="route-card__path">
                    <span className="dot dot--origin" />
                    <span>{getRegionName(route.origin_region)}</span>
                    <span className="arrow">→</span>
                    <span className="dot dot--dest" />
                    <span>{getRegionName(route.destination_region)}</span>
                  </div>
                  <StatusPill status={route.status} />
                </div>
                <div className="route-card__meta">
                  <span>🕒 {formatDateTime(route.departure_time)}</span>
                  <span>💺 {route.available_seats}/{route.total_seats} livres</span>
                  {route.vehicle_plate && <span>🚙 {route.vehicle_plate}</span>}
                  {isBroadcasting && <span className="tag" style={{ color: 'var(--teal-400)' }}>📡 Transmitindo localização</span>}
                </div>

                {route.status === 'scheduled' && (
                  <p style={{ marginTop: '0.625rem', fontSize: '0.8125rem' }}>
                    ⏸ Ainda não visível para passageiros — clique em "Iniciar rota" quando sair.
                  </p>
                )}

                {(route.status === 'open' || route.status === 'full') && stops.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
                      Itinerário — paradas em ordem
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="route-line" style={{ display: 'none' }} />
                      {stops.map((b, i) => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                          <span className="stepper__badge" style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem', flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div>
                                <p style={{ color: 'var(--cream-100)', fontSize: '0.875rem', fontWeight: 600 }}>
                                  {b.is_for_someone_else ? `${b.recipient_name} (via ${b.passenger?.name})` : b.passenger?.name}
                                </p>
                                <p style={{ fontSize: '0.75rem' }}>Assento #{b.seat_number}{b.pickup_address ? ` · ${b.pickup_address}` : ''}</p>
                              </div>
                              <div style={{ display: 'flex', gap: '0.375rem' }}>
                                <a
                                  className="btn btn-secondary btn-icon"
                                  href={whatsAppLink(b.is_for_someone_else ? b.recipient_phone : b.passenger?.phone, `Oi! Sou o motorista da carona Papaleguas, chegando em breve.`) ?? '#'}
                                  target="_blank" rel="noreferrer"
                                  onClick={(e) => { if (!whatsAppLink(b.is_for_someone_else ? b.recipient_phone : b.passenger?.phone)) e.preventDefault() }}
                                  aria-label="WhatsApp"
                                  title="Chamar no WhatsApp"
                                >
                                  💬
                                </a>
                                <button className="btn btn-ghost btn-icon" onClick={() => setActiveChat({ ...b, route })} aria-label="Abrir chat no app">✉</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span className="stepper__badge" style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.9375rem', flexShrink: 0, borderColor: 'var(--coral-500)', color: 'var(--coral-400)' }}>🏁</span>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--cream-100)', fontWeight: 600 }}>Destino final — {getRegionName(route.destination_region)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="route-card__footer">
                <span className="price-badge">{formatPrice(getPrice(route.origin_region, route.destination_region))}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {route.status === 'scheduled' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleStart(route.id)}
                      disabled={starting === route.id}
                    >
                      {starting === route.id ? 'Iniciando…' : '▶ Iniciar rota'}
                    </button>
                  )}
                  {(route.status === 'open' || route.status === 'full') && (
                    <button
                      className={isBroadcasting ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => toggleBroadcast(route.id)}
                    >
                      {isBroadcasting ? '⏹ Parar transmissão' : '📡 Transmitir localização'}
                    </button>
                  )}
                  {route.status !== 'cancelled' && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleCancel(route.id)}
                      disabled={cancelling === route.id}
                    >
                      {cancelling === route.id ? 'Cancelando…' : 'Cancelar rota'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showCreate && (
        <Modal title="Nova rota" onClose={() => setShowCreate(false)}>
          <CreateRoute
            user={user}
            onCreated={() => { setShowCreate(false); load() }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </Modal>
      )}

      {activeChat && (
        <Modal title="Chat" onClose={() => setActiveChat(null)}>
          <Chat booking={activeChat} user={user} onClose={() => setActiveChat(null)} />
        </Modal>
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    scheduled: { label: 'Agendada', cls: 'status-pill--pending' },
    open: { label: 'Aberta', cls: 'status-pill--confirmed' },
    full: { label: 'Lotada', cls: 'status-pill--pending' },
    cancelled: { label: 'Cancelada', cls: 'status-pill--cancelled' },
  }
  const s = map[status] ?? map.open
  return <span className={`status-pill ${s.cls}`}>{s.label}</span>
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '9rem', borderRadius: 'var(--radius-lg)' }} />)}
    </div>
  )
}
