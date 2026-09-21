import { Armchair, ArrowRight, CarFront, Clock3, MapPin } from 'lucide-react'
import { getPrice, getRegionName } from '../lib/supabase'
import { formatDateTime, formatDeparture, formatPrice, initials } from '../lib/format'

export default function RouteCard({ route, onReserve, onWaitlist, isOwn = false, footerExtra, distanceKm, compact = false }) {
  const availableSeats = route.seats?.filter(s => s.status === 'available').length ?? route.available_seats
  const totalSeats = route.total_seats ?? route.seats?.length ?? 0
  const price = getPrice(route.origin_region, route.destination_region)
  const full = availableSeats === 0

  if (compact) {
    return (
      <article className={`compact-route ${full ? 'is-full' : ''}`}>
        <span className="compact-route__vehicle" aria-hidden="true"><CarFront size={19} /></span>
        <div className="compact-route__main">
          <div className="compact-route__path">
            <strong>{getRegionName(route.origin_region)}</strong>
            <ArrowRight size={15} aria-hidden="true" />
            <strong>{getRegionName(route.destination_region)}</strong>
          </div>
          <p>{formatDeparture(route.departure_time)}</p>
          <div className="compact-route__availability">
            <span>{full ? 'Lotada, fila disponível' : `${availableSeats} ${availableSeats === 1 ? 'lugar disponível' : 'lugares disponíveis'}`}</span>
            {distanceKm !== undefined && distanceKm !== null && (
              <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} da origem</span>
            )}
          </div>
        </div>
        <div className="compact-route__aside">
          <strong>{formatPrice(price)}</strong>
          <button
            className={full ? 'btn btn-secondary' : 'btn btn-primary'}
            onClick={() => full ? onWaitlist?.(route) : onReserve?.(route)}
          >
            Ver viagem
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className="route-card">
      <div className="route-card__top" />
      <div className="route-card__body">
        <div className="route-card__path">
          <span className="dot dot--origin" />
          <span>{getRegionName(route.origin_region)}</span>
          <ArrowRight className="arrow" size={16} aria-hidden="true" />
          <span className="dot dot--dest" />
          <span>{getRegionName(route.destination_region)}</span>
        </div>

        {full && <span className="status-pill status-pill--pending" style={{ marginTop: '0.75rem' }}>Lotada · fila disponível</span>}

        <div className="route-card__meta">
          <span><Clock3 size={14} /> {formatDateTime(route.departure_time)}</span>
          <span><Armchair size={14} /> {availableSeats}/{totalSeats} livres</span>
          {route.vehicle_model && <span><CarFront size={14} /> {route.vehicle_model}</span>}
          {distanceKm !== undefined && distanceKm !== null && (
            <span className="tag"><MapPin size={13} /> {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}</span>
          )}
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
              className={full ? 'btn btn-secondary' : 'btn btn-primary'}
              onClick={() => full ? onWaitlist?.(route) : onReserve(route)}
            >
              {full ? 'Entrar na fila' : 'Escolher assento'}
            </button>
          )
        )}
      </div>
    </div>
  )
}
