import { useState } from 'react'
import { ArrowRight, LocateFixed } from 'lucide-react'
import { getCurrentPosition, joinRouteWaitlist, reverseGeocode } from '../lib/supabase'
import { formatDateTime } from '../lib/format'

export default function WaitlistPanel({ route, user, onDone, onError, onSuccess }) {
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupCoords, setPickupCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [joining, setJoining] = useState(false)

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

  async function join() {
    setJoining(true)
    const { error } = await joinRouteWaitlist({
      routeId: route.id,
      passengerId: user.id,
      pickupAddress,
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
    })
    setJoining(false)
    if (error) {
      onError?.(error.message?.includes('duplicate') ? 'Você já está na fila desta rota.' : 'Não foi possível entrar na fila.')
      return
    }
    onSuccess?.('Você entrou na fila. O Papaleguas avisa quando uma vaga abrir.')
    onDone?.()
  }

  return (
    <div>
      <div className="waitlist-callout">
        <strong>Reposição automática de vaga</strong>
        <p>Se alguém cancelar, a primeira pessoa da fila recebe o assento automaticamente e será notificada.</p>
      </div>
      <div className="route-summary-line">
        <span>{route.origin_address || route.origin_region}</span>
        <ArrowRight size={16} aria-hidden="true" />
        <span>{route.destination_address || route.destination_region}</span>
      </div>
      <p style={{ fontSize: '0.8125rem', margin: '0.5rem 0 1.25rem' }}>{formatDateTime(route.departure_time)}</p>
      <label className="field-label" htmlFor="waitlistPickup">Ponto de embarque (opcional)</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          id="waitlistPickup"
          className="input"
          value={pickupAddress}
          onChange={(event) => { setPickupAddress(event.target.value); setPickupCoords(null) }}
          placeholder="Rua, número, bairro"
        />
        <button type="button" className="btn btn-secondary btn-icon" onClick={useMyLocation} disabled={locating} title="Usar minha localização">
          {locating ? '…' : <LocateFixed size={18} aria-hidden="true" />}
        </button>
      </div>
      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: '1.25rem' }} onClick={join} disabled={joining}>
        {joining ? 'Entrando na fila…' : 'Entrar na lista de espera'}
      </button>
    </div>
  )
}
