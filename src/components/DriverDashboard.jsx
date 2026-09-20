import { useEffect, useMemo, useState } from 'react'
import {
  getDriverRoutes,
  cancelRoute,
  startRoute,
  getRegionName,
  orderStops,
  whatsAppLink,
  getPrice,
} from '../lib/supabase'
import { formatPrice, initials } from '../lib/format'
import { useLocationBroadcast } from '../lib/useLocationBroadcast'
import Modal from './Modal'
import Chat from './Chat'
import CreateRoute from './CreateRoute'
import RouteMap from './RouteMap'

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'scheduled', label: 'Agendadas' },
  { id: 'active', label: 'Em operação' },
  { id: 'full', label: 'Lotadas' },
  { id: 'cancelled', label: 'Canceladas' },
]

export default function DriverDashboard({ user, onError, onSuccess }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeChat, setActiveChat] = useState(null)
  const [expandedRoute, setExpandedRoute] = useState(null)
  const [filter, setFilter] = useState('all')
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

  async function handleCancel(route) {
    if (!window.confirm('Cancelar esta rota e avisar que ela não está mais disponível?')) return
    setCancelling(route.id)
    const { error } = await cancelRoute(route.id, user.id)
    if (error) onError?.('Não foi possível cancelar a rota.')
    else {
      if (activeRouteId === route.id) stopBroadcast()
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
      onSuccess?.('Rota iniciada e disponível para reservas.')
      startBroadcast(routeId, user.id)
      load()
    }
    setStarting(null)
  }

  function toggleBroadcast(routeId) {
    if (activeRouteId === routeId) {
      stopBroadcast()
      onSuccess?.('Compartilhamento de localização encerrado.')
    } else {
      startBroadcast(routeId, user.id)
      onSuccess?.('Localização em tempo real ativada.')
    }
  }

  const metrics = useMemo(() => {
    const active = routes.filter(route => ['open', 'full'].includes(route.status))
    const scheduled = routes.filter(route => route.status === 'scheduled')
    const confirmed = routes.flatMap(route => route.bookings ?? []).filter(booking => booking.status !== 'cancelled')
    const seats = routes.reduce((sum, route) => sum + Number(route.total_seats || 0), 0)
    const occupied = routes.reduce((sum, route) => sum + Math.max(0, Number(route.total_seats || 0) - Number(route.available_seats || 0)), 0)
    const revenue = routes.reduce((sum, route) => {
      const passengers = (route.bookings ?? []).filter(booking => booking.status !== 'cancelled').length
      return sum + passengers * getPrice(route.origin_region, route.destination_region)
    }, 0)
    return {
      active: active.length,
      scheduled: scheduled.length,
      passengers: confirmed.length,
      occupancy: seats ? Math.round((occupied / seats) * 100) : 0,
      revenue,
    }
  }, [routes])

  const departureQueue = routes
    .filter(route => route.status === 'scheduled')
    .sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time))

  const visibleRoutes = routes.filter(route => {
    if (filter === 'all') return true
    if (filter === 'active') return ['open', 'full'].includes(route.status)
    return route.status === filter
  })

  const mappedRoutes = routes.filter(route => route.status !== 'cancelled').slice(0, 20)

  return (
    <main className="page-container driver-console">
      <div className="driver-console__header">
        <div>
          <p className="eyebrow">Central operacional</p>
          <h1>Olá, {firstName(user.name)}</h1>
          <p>Organize partidas, acompanhe ocupação e fale com os passageiros.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Nova rota</button>
      </div>

      <section className="driver-overview" aria-label="Resumo da operação">
        <div className="driver-kpis">
          <Metric label="Rotas ativas" value={metrics.active} tone="teal" />
          <Metric label="Próximas saídas" value={metrics.scheduled} />
          <Metric label="Passageiros" value={metrics.passengers} />
          <Metric label="Ocupação" value={`${metrics.occupancy}%`} tone="amber" />
          <Metric label="Receita estimada" value={formatPrice(metrics.revenue)} wide />
        </div>
        <div className="driver-map-panel">
          <div className="driver-map-panel__header">
            <div>
              <p className="eyebrow">Cobertura</p>
              <h3>Suas rotas no mapa</h3>
            </div>
            <span className="live-chip"><span /> {mappedRoutes.length} planejadas</span>
          </div>
          <RouteMap routes={mappedRoutes} showHeader={false} />
        </div>
      </section>

      <section className="departure-board">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fila de saída</p>
            <h2>Rotas prontas para iniciar</h2>
          </div>
          <span className="tag">{departureQueue.length} agendadas</span>
        </div>

        {!loading && departureQueue.length === 0 && (
          <div className="compact-empty">Nenhuma partida aguardando início.</div>
        )}

        <div className="departure-list">
          {departureQueue.slice(0, 4).map((route, index) => (
            <article className="departure-item" key={route.id}>
              <span className="departure-item__order">{String(index + 1).padStart(2, '0')}</span>
              <div className="departure-item__time">
                <strong>{timeOnly(route.departure_time)}</strong>
                <small>{dateOnly(route.departure_time)}</small>
              </div>
              <div className="departure-item__route">
                <strong>{getRegionName(route.origin_region)} → {getRegionName(route.destination_region)}</strong>
                <small>{route.origin_address || 'Origem a confirmar'} → {route.destination_address || 'Destino a confirmar'}</small>
              </div>
              <div className="departure-item__capacity">
                <span>{route.available_seats}/{route.total_seats} vagas</span>
                <OccupancyBar route={route} />
              </div>
              <button className="btn btn-primary" onClick={() => handleStart(route.id)} disabled={starting === route.id}>
                {starting === route.id ? 'Iniciando…' : 'Iniciar rota'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="route-management">
        <div className="route-management__toolbar">
          <div>
            <p className="eyebrow">Gestão</p>
            <h2>Todas as rotas</h2>
          </div>
          <div className="segmented-control" aria-label="Filtrar rotas">
            {FILTERS.map(item => (
              <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <SkeletonList />}
        {!loading && routes.length === 0 && (
          <div className="empty-state">
            <h3>Nenhuma rota criada</h3>
            <p style={{ margin: '0.5rem 0 1.25rem' }}>Cadastre o primeiro trajeto para começar sua operação.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Criar rota</button>
          </div>
        )}
        {!loading && routes.length > 0 && visibleRoutes.length === 0 && (
          <div className="compact-empty">Nenhuma rota neste filtro.</div>
        )}

        <div className="admin-route-list">
          {visibleRoutes.map(route => {
            const activeBookings = (route.bookings ?? []).filter(booking => booking.status !== 'cancelled')
            const waitlist = (route.route_waitlist ?? []).filter(entry => entry.status === 'waiting')
            const isExpanded = expandedRoute === route.id
            const isBroadcasting = activeRouteId === route.id
            const routeRevenue = activeBookings.length * getPrice(route.origin_region, route.destination_region)
            const stops = orderStops(
              { lat: route.origin_lat, lng: route.origin_lng },
              { lat: route.destination_lat, lng: route.destination_lng },
              activeBookings
            )

            return (
              <article className="admin-route" key={route.id}>
                <button className="admin-route__summary" onClick={() => setExpandedRoute(isExpanded ? null : route.id)} aria-expanded={isExpanded}>
                  <div className="admin-route__date">
                    <strong>{timeOnly(route.departure_time)}</strong>
                    <span>{dateOnly(route.departure_time)}</span>
                  </div>
                  <div className="admin-route__path">
                    <strong>{getRegionName(route.origin_region)} → {getRegionName(route.destination_region)}</strong>
                    <span>{route.vehicle_model || user.vehicle_model || 'Veículo não informado'}{route.vehicle_plate ? ` · ${route.vehicle_plate}` : ''}</span>
                  </div>
                  <div className="admin-route__occupancy">
                    <span>{activeBookings.length} passageiros · {waitlist.length} na fila</span>
                    <OccupancyBar route={route} />
                  </div>
                  <div className="admin-route__revenue">
                    <strong>{formatPrice(routeRevenue)}</strong>
                    <span>estimado</span>
                  </div>
                  <StatusPill status={route.status} />
                  <span className="admin-route__chevron" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                </button>

                {isExpanded && (
                  <div className="admin-route__details">
                    <div className="manifest">
                      <div className="manifest__header">
                        <h3>Manifesto de passageiros</h3>
                        <span className="tag">{activeBookings.length}/{route.total_seats} ocupados</span>
                      </div>
                      {stops.length === 0 && <div className="compact-empty">Nenhuma reserva confirmada.</div>}
                      {stops.map((booking, index) => (
                        <div className="passenger-row" key={booking.id}>
                          <span className="passenger-row__stop">{index + 1}</span>
                          <span className="avatar">
                            {booking.passenger?.avatar_url
                              ? <img src={booking.passenger.avatar_url} alt="" />
                              : initials(booking.passenger?.name)}
                          </span>
                          <div className="passenger-row__identity">
                            <strong>{booking.is_for_someone_else ? booking.recipient_name : booking.passenger?.name}</strong>
                            <span>Assento {booking.seat_number}{booking.pickup_address ? ` · ${booking.pickup_address}` : ''}</span>
                          </div>
                          <div className="passenger-row__actions">
                            {whatsAppLink(booking.is_for_someone_else ? booking.recipient_phone : booking.passenger?.phone) && (
                              <a className="btn btn-secondary" href={whatsAppLink(booking.is_for_someone_else ? booking.recipient_phone : booking.passenger?.phone, 'Olá! Sou o motorista da sua rota Papaleguas.')} target="_blank" rel="noreferrer">WhatsApp</a>
                            )}
                            <button className="btn btn-ghost" onClick={() => setActiveChat({ ...booking, route })}>Mensagem</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <aside className="route-side-panel">
                      <div>
                        <p className="eyebrow">Lista de espera</p>
                        <strong>{waitlist.length} pessoas aguardando</strong>
                        <p>Cancelamentos são preenchidos automaticamente na ordem de entrada.</p>
                      </div>
                      {waitlist.slice(0, 4).map((entry, index) => (
                        <div className="waitlist-person" key={entry.id}>
                          <span>{index + 1}</span>
                          <div>
                            <strong>{entry.passenger?.name}</strong>
                            <small>{entry.passenger?.phone || 'Sem telefone'}</small>
                          </div>
                        </div>
                      ))}
                    </aside>
                  </div>
                )}

                <div className="admin-route__actions">
                  {route.status === 'scheduled' && (
                    <button className="btn btn-primary" onClick={() => handleStart(route.id)} disabled={starting === route.id}>
                      {starting === route.id ? 'Iniciando…' : 'Iniciar rota'}
                    </button>
                  )}
                  {['open', 'full'].includes(route.status) && (
                    <button className={isBroadcasting ? 'btn btn-secondary' : 'btn btn-primary'} onClick={() => toggleBroadcast(route.id)}>
                      {isBroadcasting ? 'Parar localização' : 'Transmitir localização'}
                    </button>
                  )}
                  {route.status !== 'cancelled' && (
                    <button className="btn btn-danger" onClick={() => handleCancel(route)} disabled={cancelling === route.id}>
                      {cancelling === route.id ? 'Cancelando…' : 'Cancelar rota'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {showCreate && (
        <Modal title="Planejar nova rota" onClose={() => setShowCreate(false)}>
          <CreateRoute
            user={user}
            onCreated={() => { setShowCreate(false); load() }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </Modal>
      )}

      {activeChat && (
        <Modal title="Conversa com passageiro" onClose={() => setActiveChat(null)}>
          <Chat booking={activeChat} user={user} onClose={() => setActiveChat(null)} />
        </Modal>
      )}
    </main>
  )
}

function Metric({ label, value, tone = '', wide = false }) {
  return (
    <div className={`driver-kpi ${tone ? `driver-kpi--${tone}` : ''} ${wide ? 'driver-kpi--wide' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function OccupancyBar({ route }) {
  const total = Number(route.total_seats || 0)
  const occupied = Math.max(0, total - Number(route.available_seats || 0))
  const percent = total ? Math.round((occupied / total) * 100) : 0
  return <span className="occupancy-bar"><i style={{ width: `${percent}%` }} /></span>
}

function StatusPill({ status }) {
  const map = {
    scheduled: { label: 'Agendada', cls: 'status-pill--pending' },
    open: { label: 'Aberta', cls: 'status-pill--confirmed' },
    full: { label: 'Lotada', cls: 'status-pill--pending' },
    cancelled: { label: 'Cancelada', cls: 'status-pill--cancelled' },
  }
  const item = map[status] ?? map.open
  return <span className={`status-pill ${item.cls}`}>{item.label}</span>
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1, 2, 3].map(item => <div key={item} className="skeleton" style={{ height: '6rem', borderRadius: 'var(--radius-md)' }} />)}
    </div>
  )
}

function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || 'motorista'
}

function timeOnly(value) {
  if (!value) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function dateOnly(value) {
  if (!value) return '--/--'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '')
}
