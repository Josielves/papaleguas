import { BusFront, CarFront, Star } from 'lucide-react'
import { getPrice, getRegionName } from '../lib/supabase'
import { formatDeparture, formatPrice, initials } from '../lib/format'
import RouteMap from './RouteMap'

export default function RouteDetails({ route, onReserve, onWaitlist }) {
  const availableSeats = route.seats?.filter(seat => seat.status === 'available').length ?? route.available_seats ?? 0
  const full = availableSeats === 0
  const driverName = route.driver?.name || 'Motorista'
  const vehicle = [route.vehicle_brand, route.vehicle_model, route.vehicle_color].filter(Boolean).join(' - ') || 'Veículo não informado'
  const VehicleIcon = route.vehicle_type === 'van' ? BusFront : CarFront
  const rating = Number(route.driver?.rating_average)
  const hasRating = Number.isFinite(rating) && rating > 0

  return (
    <article className="route-detail">
      <div className="route-detail__map">
        <RouteMap routes={[route]} showHeader={false} />
        <div className="route-detail__map-label" aria-hidden="true">
          <span />
          Rota prevista
        </div>
      </div>

      <div className="route-detail__content">
        <header className="route-detail__summary">
          <div>
            <p className="route-detail__path">
              <strong>{getRegionName(route.origin_region)}</strong>
              <span aria-hidden="true">→</span>
              <strong>{getRegionName(route.destination_region)}</strong>
            </p>
            <p className="route-detail__departure">{formatDeparture(route.departure_time)}</p>
          </div>
          <strong className="route-detail__price">{formatPrice(getPrice(route.origin_region, route.destination_region))}</strong>
        </header>

        <div className="route-detail__stops" aria-label="Pontos da viagem">
          <div>
            <span className="route-detail__stop-marker route-detail__stop-marker--origin" aria-hidden="true" />
            <p><small>Embarque</small>{route.origin_address || getRegionName(route.origin_region)}</p>
          </div>
          <div>
            <span className="route-detail__stop-marker route-detail__stop-marker--destination" aria-hidden="true" />
            <p><small>Destino</small>{route.destination_address || getRegionName(route.destination_region)}</p>
          </div>
        </div>

        <section className="route-detail__facts" aria-label="Informações da viagem">
          <div className="route-detail__fact">
            <span className="route-detail__fact-icon" aria-hidden="true"><VehicleIcon size={20} /></span>
            <div>
              <small>{route.vehicle_type === 'van' ? 'Van' : 'Veículo'}</small>
              <strong>{vehicle}</strong>
              {route.vehicle_plate && <span>Placa {route.vehicle_plate}{route.vehicle_capacity ? ` · ${route.vehicle_capacity} passageiros` : ''}</span>}
            </div>
          </div>

          <div className="route-detail__fact">
            <div className="avatar route-detail__avatar">
              {route.driver?.avatar_url
                ? <img src={route.driver.avatar_url} alt={`Foto de ${driverName}`} />
                : initials(driverName)}
            </div>
            <div>
              <small>Motorista</small>
              <strong>{driverName}</strong>
              <span className="route-detail__rating" aria-label={hasRating ? `Avaliação ${rating.toFixed(1)}` : 'Motorista ainda sem avaliações'}>
                <Star size={14} fill={hasRating ? 'currentColor' : 'none'} aria-hidden="true" />
                {hasRating ? rating.toFixed(1) : 'Novo motorista'}
              </span>
            </div>
          </div>
        </section>

        {route.notes && (
          <p className="route-detail__notes"><strong>Observação:</strong> {route.notes}</p>
        )}

        <footer className="route-detail__footer">
          <div>
            <strong>{full ? 'Rota lotada' : `${availableSeats} ${availableSeats === 1 ? 'lugar disponível' : 'lugares disponíveis'}`}</strong>
            <span>{full ? 'Entre na fila para ocupar a próxima vaga.' : 'Escolha seu assento na próxima etapa.'}</span>
          </div>
          <button
            className={full ? 'btn btn-secondary route-detail__action' : 'btn btn-primary route-detail__action'}
            type="button"
            onClick={() => full ? onWaitlist?.(route) : onReserve?.(route)}
          >
            {full ? 'Entrar na fila' : 'Reservar'}
          </button>
        </footer>
      </div>
    </article>
  )
}
