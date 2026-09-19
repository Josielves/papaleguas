import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// props: routeId, otherUserId (a outra pessoa da conversa: motorista ou passageiro)
export default function Chat({ routeId, otherUserId }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!routeId || !myId || !otherUserId) return

    supabase
      .from('messages')
      .select('*')
      .eq('route_id', routeId)
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`)
      .order('created_at')
      .then(({ data }) => setMessages(data || []))

    const channel = supabase
      .channel(`chat-${routeId}-${myId}-${otherUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `route_id=eq.${routeId}` },
        (payload) => {
          const m = payload.new
          const belongsToThisThread =
            (m.sender_id === myId && m.receiver_id === otherUserId) ||
            (m.sender_id === otherUserId && m.receiver_id === myId)
          if (belongsToThisThread) setMessages((prev) => [...prev, m])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [routeId, myId, otherUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    const { error } = await supabase.from('messages').insert({
      route_id: routeId,
      sender_id: myId,
      receiver_id: otherUserId,
      content,
    })
    if (error) setText(content) // devolve o texto se falhar
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
              m.sender_id === myId
                ? 'bg-[#c4ff00] text-[#0b0f08] ml-auto rounded-br-sm'
                : 'bg-[#0b0f08]/5 text-[#0b0f08] rounded-bl-sm'
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-[#0b0f08]/10">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          className="flex-1 px-4 py-2 rounded-xl border border-[#0b0f08]/10 bg-white outline-none focus:border-[#c4ff00]"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-[#0b0f08] text-[#c4ff00] font-semibold text-sm">
          Enviar
        </button>
      </form>
    </div>
  )
}
