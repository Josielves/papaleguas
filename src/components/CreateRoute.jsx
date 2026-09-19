import { useState } from 'react'
import {
  REGIONS,
  getPrice,
  getRegionName,
  createRoute,
  getCurrentPosition,
  reverseGeocode,
  geocodeAddress,
} from '../lib/supabase'
import { formatPrice } from '../lib/format'

const STEPS = [
  { id: 1, label: 'Regiões' },
  { id: 2, label: 'Endereços' },
  { id: 3, label: 'Detalhes' },
]

const emptyForm = {
  originRegion: '',
  destinationRegion: '',
  originAddress: '',
  destinationAddress: '',
  originLat: null,
  originLng: null,
  destinationLat: null,
  destinationLng: null,
  departureDate: '',
  departureTime: '',
  totalSeats: 4,
  vehicleModel: '',
  vehiclePlate: '',
  notes: '',
}

export default function CreateRoute({ user, onCreated, onError, onSuccess }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [locating, setLocating] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(patch) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function canAdvance() {
    if (step === 1) return form.originRegion && form.destinationRegion && form.originRegion !== form.destinationRegion
    if (step === 2) return form.originAddress.trim() && form.destinationAddress.trim()
    return true
  }

  async function useLocationFor(field) {
    setLocating(field)
    try {
      const pos = await getCurrentPosition()
      const address = await reverseGeocode(pos.lat, pos.lng)
      if (field === 'origin') {
        update({ originAddress: address, originLat: pos.lat, originLng: pos.lng })
      } else {
        update({ destinationAddress: address, destinationLat: pos.lat, destinationLng: pos.lng })
      }
    } catch {
      onError?.('Não foi possível obter sua localização.')
    } finally {
      setLocating('')
    }
  }

  async function geocodeOnBlur(field) {
    const address = field === 'origin' ? form.originAddress : form.destinationAddress
    if (!address?.trim()) return
    const already = field === 'origin' ? form.originLat : form.destinationLat
    if (already) return
    const result = await geocodeAddress(address)
    if (result) {
      if (field === 'origin') update({ originAddress: result.display, originLat: result.lat, originLng: result.lng })
      else update({ destinationAddress: result.display, destinationLat: result.lat, destinationLng: result.lng })
    }
  }

  async function handleSubmit() {
    if (!form.departureDate || !form.departureTime) {
      onError?.('Informe data e horário de saída.')
      return
    }
    const departureTime = new Date(`${form.departureDate}T${form.departureTime}`)
    if (departureTime < new Date()) {
      onError?.('A data de saída precisa ser no futuro.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await createRoute({
        driverId: user.id,
        originRegion: form.originRegion,
        destinationRegion: form.destinationRegion,
        originAddress: form.originAddress,
        destinationAddress: form.destinationAddress,
        originLat: form.originLat,
        originLng: form.originLng,
        destinationLat: form.destinationLat,
        destinationLng: form.destinationLng,
        departureTime: departureTime.toISOString(),
        totalSeats: Number(form.totalSeats),
        vehicleModel: form.vehicleModel,
        vehiclePlate: form.vehiclePlate,
        notes: form.notes,
      })
      if (error) throw error
      onSuccess?.('Rota criada com sucesso! 🚗')
      setForm(emptyForm)
      setStep(1)
      onCreated?.()
    } catch (err) {
      onError?.('Não foi possível criar a rota. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const price = form.originRegion && form.destinationRegion ? getPrice(form.originRegion, form.destinationRegion) : null

  return (
    <div>
      <div className="stepper">
        {STEPS.map((s, i) => (
          <div className="stepper__step-wrap" style={{ display: 'contents' }} key={s.id}>
            <div className={`stepper__step ${step === s.id ? 'is-active' : ''} ${step > s.id ? 'is-done' : ''}`}>
              <span className="stepper__badge">{step > s.id ? '✓' : s.id}</span>
              <span className="stepper__label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className="stepper__connector" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="field-label">Origem</label>
            <div className="account-type-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {REGIONS.map(r => (
                <button
                  type="button"
                  key={r.slug}
                  className={`account-type-card ${form.originRegion === r.slug ? 'is-selected' : ''}`}
                  style={{ padding: '0.875rem 0.5rem', textAlign: 'center' }}
                  onClick={() => update({ originRegion: r.slug })}
                  disabled={form.destinationRegion === r.slug}
                >
                  <h3 style={{ fontSize: '0.875rem' }}>{r.name}</h3>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="field-label">Destino</label>
            <div className="account-type-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {REGIONS.map(r => (
                <button
                  type="button"
                  key={r.slug}
                  className={`account-type-card ${form.destinationRegion === r.slug ? 'is-selected' : ''}`}
                  style={{ padding: '0.875rem 0.5rem', textAlign: 'center' }}
                  onClick={() => update({ destinationRegion: r.slug })}
                  disabled={form.originRegion === r.slug}
                >
                  <h3 style={{ fontSize: '0.875rem' }}>{r.name}</h3>
                </button>
              ))}
            </div>
          </div>
          {price !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span style={{ fontSize: '0.8125rem' }}>Preço por passageiro:</span>
              <span className="price-badge">{formatPrice(price)}</span>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ marginBottom: '1.125rem' }}>
            <label className="field-label" htmlFor="originAddress">
              Endereço de origem ({getRegionName(form.originRegion)})
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="originAddress"
                className="input"
                placeholder="Rua, número, bairro"
                value={form.originAddress}
                onChange={(e) => update({ originAddress: e.target.value, originLat: null, originLng: null })}
                onBlur={() => geocodeOnBlur('origin')}
              />
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => useLocationFor('origin')} disabled={locating === 'origin'} title="Usar minha localização">
                {locating === 'origin' ? '…' : '📍'}
              </button>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="destinationAddress">
              Endereço de destino ({getRegionName(form.destinationRegion)})
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="destinationAddress"
                className="input"
                placeholder="Rua, número, bairro"
                value={form.destinationAddress}
                onChange={(e) => update({ destinationAddress: e.target.value, destinationLat: null, destinationLng: null })}
                onBlur={() => geocodeOnBlur('destination')}
              />
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => useLocationFor('destination')} disabled={locating === 'destination'} title="Usar minha localização">
                {locating === 'destination' ? '…' : '📍'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
            <div>
              <label className="field-label" htmlFor="date">Data</label>
              <input id="date" type="date" className="input" value={form.departureDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => update({ departureDate: e.target.value })} required />
            </div>
            <div>
              <label className="field-label" htmlFor="time">Horário</label>
              <input id="time" type="time" className="input" value={form.departureTime}
                onChange={(e) => update({ departureTime: e.target.value })} required />
            </div>
          </div>

          <div style={{ marginBottom: '0.875rem' }}>
            <label className="field-label" htmlFor="seats">Assentos disponíveis</label>
            <select id="seats" className="select" value={form.totalSeats} onChange={(e) => update({ totalSeats: e.target.value })}>
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} assentos</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
            <div>
              <label className="field-label" htmlFor="model">Modelo do veículo</label>
              <input id="model" className="input" placeholder="Ex: Onix Prata" value={form.vehicleModel}
                onChange={(e) => update({ vehicleModel: e.target.value })} />
            </div>
            <div>
              <label className="field-label" htmlFor="plate">Placa</label>
              <input id="plate" className="input" placeholder="ABC1D23" value={form.vehiclePlate}
                onChange={(e) => update({ vehiclePlate: e.target.value.toUpperCase() })} />
            </div>
          </div>

          <div style={{ marginBottom: '1.125rem' }}>
            <label className="field-label" htmlFor="notes">Observações</label>
            <textarea id="notes" className="textarea" rows={2} placeholder="Ex: sem bagagem grande, ar-condicionado"
              value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
          </div>

          <div className="surface-raised" style={{ borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div className="route-card__path" style={{ marginBottom: '0.5rem' }}>
              <span className="dot dot--origin" />
              <span>{getRegionName(form.originRegion)}</span>
              <span className="arrow">→</span>
              <span className="dot dot--dest" />
              <span>{getRegionName(form.destinationRegion)}</span>
            </div>
            <p style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              {form.departureDate && form.departureTime ? `${form.departureDate.split('-').reverse().join('/')} às ${form.departureTime}` : 'Data e horário não definidos'}
            </p>
            <span className="price-badge">{formatPrice(price ?? 0)} por passageiro</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1.5rem' }}>
        {step > 1 && (
          <button className="btn btn-secondary btn-block" onClick={() => setStep(s => s - 1)} disabled={submitting}>
            Voltar
          </button>
        )}
        {step < 3 ? (
          <button className="btn btn-primary btn-block" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}>
            Continuar
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Criando rota…' : 'Publicar rota'}
          </button>
        )}
      </div>
    </div>
  )
}
