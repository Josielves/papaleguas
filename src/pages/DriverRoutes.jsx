import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Chat from '../components/Chat'

export default function DriverRoutes() {
  const [routes, setRoutes] = useState([])
  const [expandedRouteId, setExpandedRouteId] = useState(null)
  const [bookingsByRoute, setBookingsByRoute] = useState({})
  const [chatWith, setChatWith] = useState(null) // { routeId, passengerId, passengerName }

  async function loadRoutes() {
    const { data } = await supabase
      .from('routes')
      .select('*')
      .order('route_date', { ascending: true })
      .order('route_time', { ascending: true })
    setRoutes(data || [])
  }

  useEffect(() => { loadRoutes() }, [])

  async function toggleRoute(routeId) {
    if (expandedRouteId === routeId) {
      setExpandedRouteId(null)
      return
    }
    setExpandedRouteId(routeId)
    setChatWith(null)
    if (!bookingsByRoute[routeId]) {
      const { data } = await supabase
        .from('bookings')
        .select('*, seat:seats(seat_number), passenger:profiles!bookings_passenger_id_fkey(id, full_name, phone)')
        .eq('route_id', routeId)
        .eq('status', 'ativa')
        .order('created_at')
      setBookingsByRoute((prev) => ({ ...prev, [routeId]: data || [] }))
    }
  }

  const statusLabel = {
    agendada: 'Agendada',
    aberta: 'Aberta',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h2 className="text-xl font-bold text-[#0b0f08] mb-4">Minhas rotas</h2>

      {routes.length === 0 && <p className="text-sm text-[#0b0f08]/50">Você ainda não criou nenhuma rota.</p>}

      <div className="space-y-3">
        {routes.map((r) => {
          const bookings = bookingsByRoute[r.id] || []
          const seatsLeft = r.total_seats - bookings.length
          return (
            <div key={r.id} className="rounded-xl bg-white border border-[#0b0f08]/10 overflow-hidden">
              <button onClick={() => toggleRoute(r.id)} className="w-full text-left p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-[#0b0f08]">{r.origin_address} → {r.destination_address}</p>
                    <p className="text-sm text-[#0b0f08]/60">
                      {r.route_date} às {r.route_time?.slice(0, 5)} · {statusLabel[r.status]}
                    </p>
                  </div>
                  <p className="text-sm text-[#0b0f08]/60">{seatsLeft}/{r.total_seats} livres</p>
                </div>
              </button>

              {expandedRouteId === r.id && (
                <div className="border-t border-[#0b0f08]/10 p-4">
                  {bookings.length === 0 && <p className="text-sm text-[#0b0f08]/50">Nenhuma reserva ainda.</p>}
                  <div className="space-y-2">
                    {bookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-sm">
                        <span className="text-[#0b0f08]">
                          Assento {b.seat.seat_number} · {b.passenger?.full_name || b.passenger_name || 'Passageiro'}
                        </span>
                        <button
                          onClick={() =>
                            setChatWith({
                              routeId: r.id,
                              passengerId: b.passenger?.id,
                              passengerName: b.passenger?.full_name || b.passenger_name || 'Passageiro',
                            })
                          }
                          disabled={!b.passenger?.id}
                          className="text-[#0b0f08]/60 underline disabled:opacity-30"
                        >
                          conversar
                        </button>
                      </div>
                    ))}
                  </div>

                  {chatWith?.routeId === r.id && (
                    <div className="mt-4 border border-[#0b0f08]/10 rounded-xl h-72 flex flex-col">
                      <div className="px-3 py-2 border-b border-[#0b0f08]/10 text-sm font-medium text-[#0b0f08] flex justify-between">
                        {chatWith.passengerName}
                        <button onClick={() => setChatWith(null)} className="text-[#0b0f08]/40">✕</button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <Chat routeId={r.id} otherUserId={chatWith.passengerId} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
