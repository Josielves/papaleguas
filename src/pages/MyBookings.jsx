import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Chat from '../components/Chat'

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [error, setError] = useState('')
  const [chatBookingId, setChatBookingId] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        seat:seats(seat_number),
        route:routes(
          origin_address, destination_address, route_date, route_time, price,
          driver:profiles!routes_driver_id_fkey(id, full_name, phone)
        )
      `)
      .eq('status', 'ativa')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setBookings(data || [])
  }

  useEffect(() => { load() }, [])

  async function handleCancel(bookingId) {
    setError('')
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h2 className="text-xl font-bold text-[#0b0f08] mb-4">Minhas reservas</h2>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {bookings.length === 0 && <p className="text-sm text-[#0b0f08]/50">Nenhuma reserva ativa.</p>}
      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-xl bg-white border border-[#0b0f08]/10 overflow-hidden">
            <div className="p-4">
              <p className="font-semibold text-[#0b0f08]">{b.route.origin_address} → {b.route.destination_address}</p>
              <p className="text-sm text-[#0b0f08]/60 mb-3">
                {b.route.route_date} às {b.route.route_time?.slice(0, 5)} · Assento {b.seat.seat_number} · R$ {Number(b.route.price).toFixed(2)}
              </p>
              <div className="flex gap-4 text-sm">
                <button onClick={() => setChatBookingId(chatBookingId === b.id ? null : b.id)} className="text-[#0b0f08] underline">
                  {chatBookingId === b.id ? 'Fechar conversa' : `Conversar com ${b.route.driver?.full_name || 'motorista'}`}
                </button>
                <button onClick={() => handleCancel(b.id)} className="text-red-600 underline">
                  Cancelar reserva
                </button>
              </div>
            </div>

            {chatBookingId === b.id && (
              <div className="border-t border-[#0b0f08]/10 h-72 flex flex-col">
                <Chat routeId={b.route_id} otherUserId={b.route.driver?.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
