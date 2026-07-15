import { useEffect, useState } from 'react'
import {
  reserveSeat,
  subscribeToSeats,
  supabase,
  getCurrentPosition,
  reverseGeocode,
  updateBookingRecipient,
} from '../lib/supabase'
import { formatPrice } from '../lib/format'
import { getPrice } from '../lib/supabase'

export default function SeatPicker({ route, user, onDone, onError, onSuccess }) {
  const [seats, setSeats] = useState(route.seats ?? [])
  const [selected, setSelected] = useState(null)
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupCoords, setPickupCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [step, setStep] = useState('seats') // 'seats' | 'pickup' | 'recipient' | 'confirm'
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')

  useEffect(() => {
    const channel = subscribeToSeats(route.id, (payload) => {
      setSeats(prev => prev.map(s => (s.id === payload.new.id ? { ...s, ...payload.new } : s)))
    })
    return () => supabase.removeChannel(channel)
  }, [route.id])

  const sorted = [...seats].sort((a, b) => a.seat_number - b.seat_number)
  const price = getPrice(route.origin_region, route.destination_region)

  async function useMyLocation() {
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      const address = await reverseGeocode(pos.lat, pos.lng)
      setPickupCoords(pos)
      setPickupAddress(address)
    } catch {
      onError?.('Não foi possível obter sua localização.')
    } finally {
      setLocating(false)
    }
  }

  async function confirmReservation() {
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
      onSuccess?.('Assento reservado! 🎉')
      onDone?.()
    } catch (err) {
      onError?.(err?.message?.includes('duplicate') || err?.message?.includes('available')
        ? 'Esse assento acabou de ser reservado por outra pessoa.'
        : 'Não foi possível reservar. Tente novamente.')
    } finally {
      setConfirming(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Confirmar reserva</h3>
        <div className="surface-raised" style={{ borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>Assento</p>
          <p style={{ color: 'var(--cream-100)', fontWeight: 700, marginBottom: '0.75rem' }}>#{selected.seat_number}</p>
          <p style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>Embarque</p>
          <p style={{ color: 'var(--cream-100)', fontWeight: 600, marginBottom: '0.75rem' }}>{pickupAddress || 'Não informado'}</p>
          {isForSomeoneElse && (
            <>
              <p style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>Quem vai ser buscado</p>
              <p style={{ color: 'var(--cream-100)', fontWeight: 600, marginBottom: '0.75rem' }}>
                {recipientName}{recipientPhone ? ` · ${recipientPhone}` : ''}
              </p>
            </>
          )}
          <p style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>Valor</p>
          <span className="price-badge">{formatPrice(price)}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button className="btn btn-secondary btn-block" onClick={() => setStep('recipient')} disabled={confirming}>
            Voltar
          </button>
          <button className="btn btn-primary btn-block" onClick={confirmReservation} disabled={confirming}>
            {confirming ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'recipient') {
    return (
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Quem vai pegar essa carona?</h3>
        <div className="account-type-grid" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`account-type-card ${!isForSomeoneElse ? 'is-selected' : ''}`}
            onClick={() => setIsForSomeoneElse(false)}
          >
            <h3 style={{ marginBottom: '0.25rem' }}>🙋 Eu mesmo</h3>
            <p style={{ fontSize: '0.8125rem' }}>A reserva é para você</p>
          </button>
          <button
            type="button"
            className={`account-type-card ${isForSomeoneElse ? 'is-selected' : ''}`}
            onClick={() => setIsForSomeoneElse(true)}
          >
            <h3 style={{ marginBottom: '0.25rem' }}>👥 Outra pessoa</h3>
            <p style={{ fontSize: '0.8125rem' }}>Vai buscar alguém no seu lugar</p>
          </button>
        </div>

        {isForSomeoneElse && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label" htmlFor="recipientName">Nome de quem será buscado</label>
              <input
                id="recipientName"
                className="input"
                placeholder="Nome completo"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label" htmlFor="recipientPhone">WhatsApp dessa pessoa</label>
              <input
                id="recipientPhone"
                className="input"
                placeholder="(45) 99999-9999"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>
                O motorista poderá chamar essa pessoa direto pelo WhatsApp no dia da carona.
              </p>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button className="btn btn-secondary btn-block" onClick={() => setStep('pickup')}>Voltar</button>
          <button
            className="btn btn-primary btn-block"
            onClick={() => setStep('confirm')}
            disabled={isForSomeoneElse && !recipientName.trim()}
          >
            Continuar
          </button>
        </div>
      </div>
    )
  }

  if (step === 'pickup') {
    return (
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Ponto de embarque</h3>
        <p style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>Opcional — ajuda o motorista a te encontrar.</p>
        <div style={{ marginBottom: '1rem' }}>
          <label className="field-label" htmlFor="pickup">Endereço</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="pickup"
              className="input"
              placeholder="Rua, número, bairro"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
            />
            <button type="button" className="btn btn-secondary btn-icon" onClick={useMyLocation} disabled={locating} title="Usar minha localização">
              {locating ? '…' : '📍'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button className="btn btn-secondary btn-block" onClick={() => setStep('seats')}>Voltar</button>
          <button className="btn btn-primary btn-block" onClick={() => setStep('recipient')}>Continuar</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ marginBottom: '1rem' }}>Escolha seu assento</h3>
      <div className="car-interior">
        {chunk(sorted, 2).map((row, i) => (
          <div className="car-interior__row" key={i}>
            {row[0] ? <SeatButton seat={row[0]} selected={selected} onSelect={setSelected} /> : <div />}
            <div className="car-interior__aisle" />
            {row[1] ? <SeatButton seat={row[1]} selected={selected} onSelect={setSelected} /> : <div />}
          </div>
        ))}
      </div>
      <div className="seat-legend">
        <span><span className="swatch" style={{ background: 'var(--ink-800)', border: '1.5px solid var(--line-600)' }} /> Livre</span>
        <span><span className="swatch" style={{ background: 'var(--amber-500)' }} /> Selecionado</span>
        <span><span className="swatch" style={{ background: 'var(--ink-950)', border: '1.5px solid var(--line-700)' }} /> Ocupado</span>
      </div>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: '1.25rem' }}
        disabled={!selected}
        onClick={() => setStep('pickup')}
      >
        Continuar
      </button>
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
      aria-label={`Assento ${seat.seat_number}${taken ? ' (ocupado)' : ''}`}
    >
      {seat.seat_number}
    </button>
  )
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
