import { useEffect, useState } from 'react'
import { getMyBookings, cancelBooking, getRegionName } from '../lib/supabase'
import { formatDateTime, formatPrice, initials } from '../lib/format'
import { getPrice } from '../lib/supabase'
import Modal from './Modal'
import Chat from './Chat'

export default function MyBookings({ user, onError, onSuccess }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChat, setActiveChat] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await getMyBookings(user.id)
    if (error) onError?.('Não foi possível carregar suas reservas.')
    setBookings(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  async function handleCancel(booking) {
    setCancelling(booking.id)
    const { error } = await cancelBooking(booking.id, booking.seat_id, booking.route.id, user.id)
    if (error) onError?.('Não foi possível cancelar a reserva.')
    else {
      onSuccess?.('Reserva cancelada.')
      load()
    }
    setCancelling(null)
  }

  return (
    <div className="page-container">
      <div className="section-heading">
        <div>
          <h2>Minhas reservas</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Acompanhe suas caronas</p>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '8rem', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="empty-state">
          <h3 style={{ marginBottom: '0.5rem' }}>Você ainda não tem reservas</h3>
          <p>Explore as rotas abertas e reserve seu assento.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {bookings.map(b => (
          <div className="route-card" key={b.id}>
            <div className="route-card__top" />
            <div className="route-card__body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div className="route-card__path">
                  <span className="dot dot--origin" />
                  <span>{getRegionName(b.route?.origin_region)}</span>
                  <span className="arrow">→</span>
                  <span className="dot dot--dest" />
                  <span>{getRegionName(b.route?.destination_region)}</span>
                </div>
                <StatusPill status={b.status} />
              </div>

              <div className="route-card__meta">
                <span>🕒 {formatDateTime(b.route?.departure_time)}</span>
                <span>💺 Assento #{b.seat_number}</span>
              </div>

              {b.pickup_address && (
                <p style={{ marginTop: '0.625rem', fontSize: '0.8125rem' }}>📍 {b.pickup_address}</p>
              )}

              {b.route?.driver && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.875rem' }}>
                  <div className="avatar">{initials(b.route.driver.name)}</div>
                  <div>
                    <p style={{ color: 'var(--cream-100)', fontSize: '0.875rem', fontWeight: 600 }}>{b.route.driver.name}</p>
                    <p style={{ fontSize: '0.75rem' }}>Motorista</p>
                  </div>
                </div>
              )}
            </div>

            <div className="route-card__footer">
              <span className="price-badge">{formatPrice(getPrice(b.route?.origin_region, b.route?.destination_region))}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {b.status !== 'cancelled' && (
                  <>
                    <button className="btn btn-ghost btn-icon" onClick={() => setActiveChat(b)} aria-label="Abrir chat">💬</button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleCancel(b)}
                      disabled={cancelling === b.id}
                    >
                      {cancelling === b.id ? 'Cancelando…' : 'Cancelar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

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
    confirmed: { label: 'Confirmada', cls: 'status-pill--confirmed' },
    pending: { label: 'Pendente', cls: 'status-pill--pending' },
    cancelled: { label: 'Cancelada', cls: 'status-pill--cancelled' },
  }
  const s = map[status] ?? map.confirmed
  return <span className={`status-pill ${s.cls}`}>{s.label}</span>
}
