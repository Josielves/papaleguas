import { useEffect, useState } from 'react'
import { BusFront, CarFront, LocateFixed, MapPin } from 'lucide-react'
import {
  reserveSeat,
  subscribeToSeats,
  supabase,
  getCurrentPosition,
  reverseGeocode,
  updateBookingRecipient,
  getPrice,
} from '../lib/supabase'
import { formatPrice } from '../lib/format'

export default function SeatPicker({ route, user, onDone, onError, onSuccess }) {
  const [seats, setSeats] = useState(route.seats ?? [])
  const [selected, setSelected] = useState(null)
  const [pickupAddress, setPickupAddress] = useState(route.origin_address || '')
  const [pickupCoords, setPickupCoords] = useState(
    route.origin_lat && route.origin_lng ? { lat: route.origin_lat, lng: route.origin_lng } : null
  )
  const [locating, setLocating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')

  useEffect(() => {
    const channel = subscribeToSeats(route.id, (payload) => {
      setSeats(previous => previous.map(seat => (
        seat.id === payload.new.id ? { ...seat, ...payload.new } : seat
      )))
      if (payload.new.status !== 'available') {
        setSelected(current => current?.id === payload.new.id ? null : current)
      }
    })
    return () => supabase.removeChannel(channel)
  }, [route.id])

  const sorted = [...seats].sort((left, right) => left.seat_number - right.seat_number)
  const price = getPrice(route.origin_region, route.destination_region)
  const canConfirm = Boolean(selected && (!isForSomeoneElse || recipientName.trim()))
  const VehicleIcon = route.vehicle_type === 'van' ? BusFront : CarFront

  async function useMyLocation() {
    setLocating(true)
    try {
      const position = await getCurrentPosition()
      const address = await reverseGeocode(position.lat, position.lng)
      setPickupCoords(position)
      setPickupAddress(address)
    } catch {
      onError?.('Não foi possível obter sua localização.')
    } finally {
      setLocating(false)
    }
  }

  async function confirmReservation() {
    if (!canConfirm) return
    setConfirming(true)
    try {
      const { data, error } = await reserveSeat({
        routeId: route.id,
        seatNumber: selected.seat_number,
        passengerId: user.id,
        pickupAddress,
        pickupLat: pickupCoords?.lat,
        pickupLng: pickupCoords?.lng,
      })
      if (error) throw error
      if (isForSomeoneElse && data?.id) {
        await updateBookingRecipient(data.id, { isForSomeoneElse, recipientName, recipientPhone })
      }
      onSuccess?.('Assento reservado!')
      onDone?.()
    } catch (error) {
      onError?.(error?.message?.includes('duplicate') || error?.message?.includes('available')
        ? 'Esse assento acabou de ser reservado por outra pessoa.'
        : 'Não foi possível reservar. Tente novamente.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="seat-booking">
      <section className="vehicle-view" aria-labelledby="vehicle-view-title">
        <div className="vehicle-view__heading">
          <div>
            <p className="eyebrow">Mapa de assentos</p>
            <h3 id="vehicle-view-title">Visão do veículo</h3>
          </div>
          <span aria-hidden="true"><VehicleIcon size={20} /></span>
        </div>

        <div className={`vehicle-cabin ${route.vehicle_type === 'van' ? 'vehicle-cabin--van' : ''}`}>
          <div className="vehicle-cabin__front" aria-hidden="true">
            <span className="vehicle-cabin__wheel">◉</span>
            <small>Frente</small>
          </div>

          <div className="vehicle-cabin__seats" role="group" aria-label="Assentos do veículo">
            {chunk(sorted, 2).map((row, index) => (
              <div className="vehicle-cabin__row" key={index}>
                {row[0] ? <SeatButton seat={row[0]} selected={selected} onSelect={setSelected} /> : <span />}
                <span className="vehicle-cabin__aisle" aria-hidden="true" />
                {row[1] ? <SeatButton seat={row[1]} selected={selected} onSelect={setSelected} /> : <span />}
              </div>
            ))}
          </div>
        </div>

        <div className="seat-legend" aria-label="Legenda dos assentos">
          <span><span className="swatch swatch--available" /> Disponível</span>
          <span><span className="swatch swatch--selected" /> Selecionado</span>
          <span><span className="swatch swatch--taken" /> Ocupado</span>
        </div>
      </section>

      <section className="seat-booking__details" aria-label="Detalhes da reserva">
        <div className="seat-booking__selected" aria-live="polite">
          <small>Assento selecionado</small>
          <strong>{selected ? String(selected.seat_number).padStart(2, '0') : '--'}</strong>
        </div>

        <div className="seat-booking__pickup">
          <label className="field-label" htmlFor="pickup">Embarque</label>
          <div className="seat-booking__pickup-field">
            <span aria-hidden="true"><MapPin size={18} /></span>
            <input
              id="pickup"
              className="input"
              placeholder="Rua, número, bairro"
              value={pickupAddress}
              onChange={(event) => {
                setPickupAddress(event.target.value)
                setPickupCoords(null)
              }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={useMyLocation}
              disabled={locating}
              title="Usar minha localização"
              aria-label="Usar minha localização"
            >
              {locating ? '…' : <LocateFixed size={18} aria-hidden="true" />}
            </button>
          </div>
          <p>Você pode ajustar o ponto onde o motorista irá encontrá-lo.</p>
        </div>

        <label className="seat-booking__recipient-toggle">
          <input
            type="checkbox"
            checked={isForSomeoneElse}
            onChange={(event) => setIsForSomeoneElse(event.target.checked)}
          />
          <span>
            <strong>Reservar para outra pessoa</strong>
            <small>Informe quem será buscado pelo motorista.</small>
          </span>
        </label>

        {isForSomeoneElse && (
          <div className="seat-booking__recipient-fields">
            <div>
              <label className="field-label" htmlFor="recipientName">Nome</label>
              <input
                id="recipientName"
                className="input"
                placeholder="Nome completo"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="recipientPhone">WhatsApp</label>
              <input
                id="recipientPhone"
                className="input"
                placeholder="(45) 99999-9999"
                value={recipientPhone}
                onChange={(event) => setRecipientPhone(event.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      <footer className="seat-booking__footer">
        <div>
          <small>Valor</small>
          <strong>{formatPrice(price)}</strong>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!canConfirm || confirming}
          onClick={confirmReservation}
        >
          {confirming ? 'Confirmando…' : 'Confirmar reserva'}
        </button>
      </footer>
    </div>
  )
}

function SeatButton({ seat, selected, onSelect }) {
  const taken = seat.status !== 'available'
  const isSelected = selected?.id === seat.id

  return (
    <button
      type="button"
      className={`seat ${isSelected ? 'seat--selected' : ''} ${taken ? 'seat--taken' : ''}`}
      disabled={taken}
      onClick={() => onSelect(seat)}
      aria-pressed={isSelected}
      aria-label={`Assento ${seat.seat_number}${taken ? ', ocupado' : isSelected ? ', selecionado' : ', disponível'}`}
    >
      {seat.seat_number}
    </button>
  )
}

function chunk(items, size) {
  const rows = []
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size))
  return rows
}
