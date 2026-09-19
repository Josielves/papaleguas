import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SearchRoutes() {
  const [regions, setRegions] = useState([])
  const [originId, setOriginId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [seats, setSeats] = useState([])
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    supabase.from('regions').select('*').order('name').then(({ data }) => setRegions(data || []))
  }, [])

  async function search() {
    let query = supabase
      .from('routes')
      .select('*, driver:profiles!routes_driver_id_fkey(full_name, phone)')
      .eq('status', 'aberta')
      .order('route_date', { ascending: true })
      .order('route_time', { ascending: true })

    if (originId) query = query.eq('origin_region_id', originId)
    if (destinationId) query = query.eq('destination_region_id', destinationId)

    const { data, error } = await query
    if (error) setError(error.message)
    else setRoutes(data || [])
  }

  useEffect(() => { search() }, []) // eslint-disable-line

  async function openRoute(route) {
    setSelectedRoute(route)
    setError('')
    const { data } = await supabase.from('seats').select('*').eq('route_id', route.id).order('seat_number')
    setSeats(data || [])
  }

  // assentos ao vivo: qualquer reserva feita por outro passageiro aparece na hora
  useEffect(() => {
    if (!selectedRoute) return
    const channel = supabase
      .channel(`seats-${selectedRoute.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'seats', filter: `route_id=eq.${selectedRoute.id}` },
        (payload) => {
          setSeats((prev) => prev.map((s) => (s.id === payload.new.id ? payload.new : s)))
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [selectedRoute])

  async function handleBook(seatId) {
    setBooking(true)
    setError('')
    try {
      const { error } = await supabase.rpc('book_seat', { p_seat_id: seatId })
      if (error) throw error
      const { data } = await supabase.from('seats').select('*').eq('route_id', selectedRoute.id).order('seat_number')
      setSeats(data || [])
    } catch (err) {
      setError(err.message === 'Assento já reservado' ? 'Esse assento acabou de ser reservado por outra pessoa.' : err.message)
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h2 className="text-xl font-bold text-[#0b0f08] mb-4">Buscar caronas</h2>

      <div className="flex gap-2 mb-4">
        <select value={originId} onChange={(e) => setOriginId(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-[#0b0f08]/10 bg-white text-sm">
          <option value="">Origem</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-[#0b0f08]/10 bg-white text-sm">
          <option value="">Destino</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button onClick={search} className="px-4 py-2 rounded-xl bg-[#0b0f08] text-[#c4ff00] text-sm font-semibold">Buscar</button>
      </div>

      {!selectedRoute && (
        <div className="space-y-3">
          {routes.length === 0 && <p className="text-sm text-[#0b0f08]/50">Nenhuma rota encontrada.</p>}
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => openRoute(r)}
              className="w-full text-left p-4 rounded-xl bg-white border border-[#0b0f08]/10 hover:border-[#c4ff00] transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-[#0b0f08]">{r.origin_address} → {r.destination_address}</p>
                  <p className="text-sm text-[#0b0f08]/60">{r.route_date} às {r.route_time?.slice(0, 5)} · {r.driver?.full_name}</p>
                </div>
                <p className="font-bold text-[#0b0f08]">R$ {Number(r.price).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedRoute && (
        <div>
          <button onClick={() => setSelectedRoute(null)} className="text-sm text-[#0b0f08]/60 underline mb-4">← voltar pra busca</button>
          <p className="font-semibold text-[#0b0f08] mb-1">{selectedRoute.origin_address} → {selectedRoute.destination_address}</p>
          <p className="text-sm text-[#0b0f08]/60 mb-4">{selectedRoute.route_date} às {selectedRoute.route_time?.slice(0, 5)}</p>

          <p className="text-sm font-medium text-[#0b0f08] mb-2">Escolha um assento</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {seats.map((s) => (
              <button
                key={s.id}
                disabled={s.status !== 'disponivel' || booking}
                onClick={() => handleBook(s.id)}
                className={`py-3 rounded-xl font-semibold text-sm transition ${
                  s.status === 'disponivel'
                    ? 'bg-white border border-[#0b0f08]/10 text-[#0b0f08] hover:bg-[#c4ff00]'
                    : 'bg-[#0b0f08]/10 text-[#0b0f08]/30 cursor-not-allowed'
                }`}
              >
                {s.seat_number}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
