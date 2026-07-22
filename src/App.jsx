import { useCallback, useEffect, useState } from 'react'
import { supabase, getProfile, signOut } from './lib/supabase'
import Auth from './components/Auth'
import OpenRoutes from './components/OpenRoutes'
import MyBookings from './components/MyBookings'
import DriverDashboard from './components/DriverDashboard'
import EditProfile from './components/EditProfile'
import Modal from './components/Modal'
import Toast, { useToast } from './components/Toast'
import { initials } from './lib/format'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('routes')
  const [showProfile, setShowProfile] = useState(false)
  const { toast, showToast } = useToast()

  const loadProfile = useCallback(async (userId) => {
    const { data } = await getProfile(userId)
    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  useEffect(() => {
    if (profile?.account_type === 'driver') setView('dashboard')
    else setView('routes')
  }, [profile?.account_type])

  if (session === undefined) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: '3rem', height: '3rem', borderRadius: '999px' }} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center' }}>
        <Auth onAuthed={() => {}} />
        <Toast toast={toast} />
      </div>
    )
  }

  const isDriver = profile?.account_type === 'driver'
  const displayName = profile?.name ?? session.user.email

  const tabs = isDriver
    ? [{ id: 'dashboard', label: 'Painel', icon: '🚗' }]
    : [
        { id: 'routes', label: 'Rotas', icon: '🗺️' },
        { id: 'bookings', label: 'Reservas', icon: '🎟️' },
      ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">Papaleguas</div>
          <nav className="nav-tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`nav-tab ${view === t.id ? 'is-active' : ''}`}
                onClick={() => setView(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="avatar" style={{ border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden' }} title="Editar perfil" onClick={() => setShowProfile(true)}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials(displayName)}
            </button>
            <button className="btn btn-ghost" onClick={() => signOut()}>Sair</button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {profile ? (
          <>
            {!isDriver && view === 'routes' && (
              <OpenRoutes user={profile} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />
            )}
            {!isDriver && view === 'bookings' && (
              <MyBookings user={profile} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />
            )}
            {isDriver && view === 'dashboard' && (
              <DriverDashboard user={profile} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />
            )}
          </>
        ) : (
          <div className="page-container">
            <div className="skeleton" style={{ height: '10rem', borderRadius: 'var(--radius-lg)' }} />
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`bottom-nav__item ${view === t.id ? 'is-active' : ''}`}
            onClick={() => setView(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <Toast toast={toast} />

      {showProfile && profile && (
        <Modal title="Meu perfil" onClose={() => setShowProfile(false)}>
          <EditProfile
            user={profile}
            onClose={() => setShowProfile(false)}
            onUpdated={() => loadProfile(session.user.id)}
            onError={(m) => showToast(m, 'error')}
            onSuccess={(m) => showToast(m, 'success')}
          />
        </Modal>
      )}
    </div>
  )
}
