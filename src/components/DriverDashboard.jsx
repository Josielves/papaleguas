import { useEffect, useState } from 'react'
import { getDriverRoutes, cancelRoute, getRegionName } from '../lib/supabase'
import { formatDateTime, formatPrice, initials } from '../lib/format'
import { getPrice } from '../lib/supabase'
import Modal from './Modal'
import Chat from './Chat'
import CreateRoute from './CreateRoute'

export default function DriverDashboard({ user, onError, onSuccess }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeChat, setActiveChat] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await getDriverRoutes(user.id)
    if (error) onError?.('Não foi possível carregar suas rotas.')
    setRoutes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  async function handleCancel(routeId) {
    setCancelling(routeId)
    const { error } = await cancelRoute(routeId)
    if (error) onError?.('Não foi possível cancelar a rota.')
    else {
      onSuccess?.('Rota cancelada.')
      load()
    }
    setCancelling(null)
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
        {routes.map(route => (
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
              </div>

              {route.bookings?.filter(b => b.status !== 'cancelled').length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Passageiros</p>
                  {route.bookings.filter(b => b.status !== 'cancelled').map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.625rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div className="avatar">{initials(b.passenger?.name)}</div>
                        <div>
                          <p style={{ color: 'var(--cream-100)', fontSize: '0.875rem', fontWeight: 600 }}>{b.passenger?.name}</p>
                          <p style={{ fontSize: '0.75rem' }}>Assento #{b.seat_number}{b.pickup_address ? ` · ${b.pickup_address}` : ''}</p>
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-icon" onClick={() => setActiveChat({ ...b, route })} aria-label="Abrir chat">💬</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="route-card__footer">
              <span className="price-badge">{formatPrice(getPrice(route.origin_region, route.destination_region))}</span>
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
        ))}
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
