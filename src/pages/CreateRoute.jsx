import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STEPS = ['Origem e destino', 'Endereços', 'Data, horário e veículo']

export default function CreateRoute({ onCreated }) {
  const [step, setStep] = useState(0)
  const [regions, setRegions] = useState([])
  const [price, setPrice] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    originRegionId: '',
    destinationRegionId: '',
    originAddress: '',
    originLat: null,
    originLng: null,
    destinationAddress: '',
    destinationLat: null,
    destinationLng: null,
    routeDate: '',
    routeTime: '',
    totalSeats: 4,
    vehicleModel: '',
    vehiclePlate: '',
  })

  useEffect(() => {
    supabase.from('regions').select('*').order('name').then(({ data }) => setRegions(data || []))
  }, [])

  // busca o preço automático assim que origem e destino estiverem escolhidos
  useEffect(() => {
    if (!form.originRegionId || !form.destinationRegionId) {
      setPrice(null)
      return
    }
    supabase
      .rpc('calculate_route_price', {
        p_origin_region_id: form.originRegionId,
        p_destination_region_id: form.destinationRegionId,
      })
      .then(({ data, error }) => {
        if (error) {
          setPrice(null)
          setError('Não existe preço cadastrado para essa rota ainda.')
        } else {
          setPrice(data)
          setError('')
        }
      })
  }, [form.originRegionId, form.destinationRegionId])

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function useMyLocation(latField, lngField, addressField) {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        [latField]: pos.coords.latitude,
        [lngField]: pos.coords.longitude,
        [addressField]: f[addressField] || `Localização atual (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
      }))
    })
  }

  function canAdvance() {
    if (step === 0) return form.originRegionId && form.destinationRegionId && form.originRegionId !== form.destinationRegionId
    if (step === 1) return form.originAddress && form.destinationAddress
    if (step === 2) return form.routeDate && form.routeTime && form.totalSeats > 0 && form.vehicleModel && form.vehiclePlate
    return false
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('create_route_with_seats', {
        p_origin_region_id: form.originRegionId,
        p_destination_region_id: form.destinationRegionId,
        p_origin_address: form.originAddress,
        p_origin_lat: form.originLat,
        p_origin_lng: form.originLng,
        p_destination_address: form.destinationAddress,
        p_destination_lat: form.destinationLat,
        p_destination_lng: form.destinationLng,
        p_route_date: form.routeDate,
        p_route_time: form.routeTime,
        p_total_seats: Number(form.totalSeats),
        p_vehicle_model: form.vehicleModel,
        p_vehicle_plate: form.vehiclePlate,
      })
      if (error) throw error
      onCreated?.(data)
    } catch (err) {
      setError(err.message || 'Não deu pra criar a rota.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="flex gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-[#c4ff00]' : 'bg-[#0b0f08]/10'}`} />
        ))}
      </div>
      <h2 className="text-xl font-bold text-[#0b0f08] mb-6">{STEPS[step]}</h2>

      {step === 0 && (
        <div className="space-y-3">
          <select value={form.originRegionId} onChange={update('originRegionId')} className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white">
            <option value="">Região de origem</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select value={form.destinationRegionId} onChange={update('destinationRegionId')} className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white">
            <option value="">Região de destino</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {price !== null && (
            <p className="text-sm text-[#0b0f08]/70">Preço por assento: <span className="font-semibold text-[#0b0f08]">R$ {Number(price).toFixed(2)}</span></p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <input placeholder="Endereço de origem" value={form.originAddress} onChange={update('originAddress')} className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white" />
            <button type="button" onClick={() => useMyLocation('originLat', 'originLng', 'originAddress')} className="text-xs text-[#0b0f08]/60 underline mt-1">
              usar minha localização atual
            </button>
          </div>
          <div>
            <input placeholder="Endereço de destino" value={form.destinationAddress} onChange={update('destinationAddress')} className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <input type="date" value={form.routeDate} onChange={update('routeDate')} className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white" />
          <input type="time" value={form.routeTime} onChange={update('routeTime')} className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white" />
          <input type="number" min={1} max={20} value={form.totalSeats} onChange={update('totalSeats')} placeholder="Assentos disponíveis" className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white" />
          <input value={form.vehicleModel} onChange={update('vehicleModel')} placeholder="Modelo do veículo" className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white" />
          <input value={form.vehiclePlate} onChange={update('vehiclePlate')} placeholder="Placa" className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white uppercase" />
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex gap-2 mt-8">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 py-3 rounded-xl border border-[#0b0f08]/10 text-[#0b0f08] font-medium">
            Voltar
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button disabled={!canAdvance()} onClick={() => setStep(step + 1)} className="flex-1 py-3 rounded-xl bg-[#0b0f08] text-[#c4ff00] font-semibold disabled:opacity-40">
            Continuar
          </button>
        ) : (
          <button disabled={!canAdvance() || loading} onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-[#0b0f08] text-[#c4ff00] font-semibold disabled:opacity-40">
            {loading ? 'Publicando…' : 'Publicar rota'}
          </button>
        )}
      </div>
    </div>
  )
}
