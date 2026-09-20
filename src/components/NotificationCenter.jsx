import { useEffect, useRef, useState } from 'react'
import {
  getNotifications,
  markNotificationRead,
  subscribeToNotifications,
  supabase,
} from '../lib/supabase'
import { formatDateTime } from '../lib/format'
import Logo from './Logo'

export default function NotificationCenter({ user, onNotice }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  async function load() {
    const { data } = await getNotifications(user.id)
    setItems(data ?? [])
  }

  useEffect(() => {
    load()
    const channel = subscribeToNotifications(user.id, ({ new: notification }) => {
      setItems(prev => [notification, ...prev])
      onNotice?.(notification.message)
    })
    return () => supabase.removeChannel(channel)
  }, [user.id])

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  async function openItem(item) {
    if (!item.read_at) {
      await markNotificationRead(item.id, user.id)
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
    }
  }

  const unread = items.filter(item => !item.read_at).length

  return (
    <div className="notification-center" ref={ref}>
      <button
        type="button"
        className="notification-trigger"
        onClick={() => setOpen(value => !value)}
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}
        title="Notificações"
      >
        <Logo compact />
        {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notification-menu">
          <div className="notification-menu__header">
            <div>
              <p className="eyebrow">Recados do Papaleguas</p>
              <h3>Notificações</h3>
            </div>
            <span className="tag">{unread} novas</span>
          </div>
          <div className="notification-list">
            {items.length === 0 && <p className="notification-empty">Nenhuma novidade por enquanto.</p>}
            {items.map(item => (
              <button
                type="button"
                key={item.id}
                className={`notification-item ${item.read_at ? '' : 'is-unread'}`}
                onClick={() => openItem(item)}
              >
                <span className="notification-item__dot" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.message}</small>
                  <time>{formatDateTime(item.created_at)}</time>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
