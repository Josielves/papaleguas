import { useEffect, useRef, useState } from 'react'
import { getMessages, sendMessage, subscribeToMessages, supabase } from '../lib/supabase'
import { formatTime, initials } from '../lib/format'

export default function Chat({ booking, user, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getMessages(booking.id).then(({ data }) => {
      if (active) {
        setMessages(data ?? [])
        setLoading(false)
      }
    })
    const channel = subscribeToMessages(booking.id, (payload) => {
      setMessages(prev => {
        if (prev.some(m => m.id === payload.new.id)) return prev
        // Replace matching optimistic message if present
        const withoutOptimistic = prev.filter(m => !(m.optimistic && m.content === payload.new.content && m.sender_id === payload.new.sender_id))
        return [...withoutOptimistic, payload.new]
      })
    })
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [booking.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e?.preventDefault()
    const content = text.trim()
    if (!content) return
    setText('')
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      content,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      optimistic: true,
    }
    setMessages(prev => [...prev, optimistic])
    const { error } = await sendMessage({
      bookingId: booking.id,
      routeId: booking.route_id ?? booking.route?.id,
      senderId: user.id,
      content,
    })
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(content)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherName = booking.route?.driver?.id === user.id ? booking.passenger?.name : booking.route?.driver?.name

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="avatar">{initials(otherName || 'Chat')}</div>
          <div>
            <p style={{ color: 'var(--cream-100)', fontWeight: 600, fontSize: '0.9375rem' }}>{otherName || 'Conversa'}</p>
            <p style={{ fontSize: '0.75rem' }}>Reserva #{String(booking.id).slice(0, 8)}</p>
          </div>
        </div>
        {onClose && (
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar chat">✕</button>
        )}
      </div>

      <div className="chat-panel__messages" ref={scrollRef}>
        {loading && <p style={{ textAlign: 'center', fontSize: '0.8125rem' }}>Carregando conversa…</p>}
        {!loading && messages.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.8125rem' }}>Diga oi para combinar os detalhes da carona 👋</p>
        )}
        {messages.map(m => {
          const mine = m.sender_id === user.id
          return (
            <div key={m.id} className={`bubble ${mine ? 'bubble--mine' : 'bubble--theirs'} ${m.optimistic ? 'bubble--optimistic' : ''}`}>
              <div>{m.content}</div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.7, marginTop: '0.2rem', textAlign: 'right' }}>
                {formatTime(m.created_at)}
              </div>
            </div>
          )
        })}
      </div>

      <form className="chat-panel__composer" onSubmit={handleSend}>
        <textarea
          className="textarea"
          rows={1}
          placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ resize: 'none' }}
        />
        <button className="btn btn-primary btn-icon" type="submit" aria-label="Enviar" disabled={!text.trim()}>
          ➤
        </button>
      </form>
    </div>
  )
}
