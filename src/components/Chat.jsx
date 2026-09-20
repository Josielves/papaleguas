import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Chat({ booking, user, routeId, otherUserId }) {
  const { session } = useAuth()
  const myId = user?.id ?? session?.user?.id
  const bookingId = booking?.id
  const resolvedRouteId = booking?.route_id ?? booking?.route?.id ?? routeId
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!bookingId || !resolvedRouteId || !myId) return

    supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at')
      .then(({ data }) => setMessages(data || []))

    const channel = supabase
      .channel(`chat-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [bookingId, resolvedRouteId, myId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    const { error } = await supabase.from('messages').insert({
      booking_id: bookingId,
      route_id: resolvedRouteId,
      sender_id: myId,
      content,
    })
    if (error) setText(content) // devolve o texto se falhar
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`bubble ${m.sender_id === myId ? 'bubble--mine' : 'bubble--theirs'}`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="chat-panel__composer">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="input"
          disabled={!bookingId}
        />
        <button type="submit" className="btn btn-primary" disabled={!bookingId}>
          Enviar
        </button>
      </form>
    </div>
  )
}
