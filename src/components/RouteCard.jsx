import { getPrice, getRegionName } from '../lib/supabase'
import { formatDateTime, formatPrice, initials } from '../lib/format'

export default function RouteCard({ route, onReserve, isOwn = false, footerExtra }) {
  const availableSeats = route.seats?.filter(s => s.status === 'available').length ?? route.available_seats
  const totalSeats = route.total_seats ?? route.seats?.length ?? 0
  const price = getPrice(route.origin_region, route.destination_region)
  const full = availableSeats === 0

  return (
    <div className="route-card">
      <div className="route-card__top" />
      <div className="route-card__body">
        <div className="route-card__path">
          <span className="dot dot--origin" />
          <span>{getRegionName(route.origin_region)}</span>
          <span className="arrow">→</span>
          <span className="dot dot--dest" />
          <span>{getRegionName(route.destination_region)}</span>
        </div>

        <div className="route-card__meta">
          <span>🕒 {formatDateTime(route.departure_time)}</span>
          <span>💺 {availableSeats}/{totalSeats} livres</span>
          {route.vehicle_model && <span>🚙 {route.vehicle_model}</span>}
        </div>

        {!isOwn && route.driver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.875rem' }}>
            <div className="avatar">
              {route.driver.avatar_url
                ? <img src={route.driver.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials(route.driver.name)}
            </div>
            <div>
              <p style={{ color: 'var(--cream-100)', fontSize: '0.875rem', fontWeight: 600 }}>{route.driver.name}</p>
              <p style={{ fontSize: '0.75rem' }}>Motorista</p>
            </div>
          </div>
        )}

        {route.notes && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }}>"{route.notes}"</p>
        )}
      </div>

      <div className="route-card__footer">
        <span className="price-badge">{formatPrice(price)}</span>
        {footerExtra ? footerExtra : (
          onReserve && (
            <button
              className="btn btn-primary"
              disabled={full}
              onClick={() => onReserve(route)}
            >
              {full ? 'Lotada' : 'Reservar assento'}
            </button>
          )
        )}
      </div>
    </div>
  )
}
