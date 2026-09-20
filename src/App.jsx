import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './components/Auth'
import DriverDashboard from './components/DriverDashboard'
import OpenRoutes from './components/OpenRoutes'
import MyBookings from './components/MyBookings'
import Toast from './components/Toast'

function Shell() {
  const { session, profile, loading, signOut } = useAuth()
  const [tab, setTab] = useState('main')
  const [toast, setToast] = useState(null)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#0b0f08]/50">Carregando...</div>
  if (!session) return <Auth />
  if (!profile?.role) return <div className="min-h-screen flex items-center justify-center text-[#0b0f08]/50">Completando seu cadastro...</div>

  const user = { ...session.user, ...profile, id: session.user.id }
  const isDriver = profile.role === 'driver'
  const tabs = isDriver
    ? [{ id: 'main', label: 'Painel' }]
    : [{ id: 'main', label: 'Buscar' }, { id: 'bookings', label: 'Minhas reservas' }]

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <span className="brand">Papaleguas</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!isDriver && (
              <nav className="nav-tabs" aria-label="Navegação principal">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`nav-tab ${tab === t.id ? 'is-active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            )}
            <button onClick={signOut} className="btn btn-ghost">Sair</button>
          </div>
        </div>
      </header>

      {isDriver ? (
        <DriverDashboard
          user={user}
          onError={(message) => showToast(message, 'error')}
          onSuccess={(message) => showToast(message, 'success')}
        />
      ) : (
        tab === 'main'
          ? (
            <OpenRoutes
              user={user}
              onError={(message) => showToast(message, 'error')}
              onSuccess={(message) => showToast(message, 'success')}
            />
          )
          : (
            <MyBookings
              user={user}
              onError={(message) => showToast(message, 'error')}
              onSuccess={(message) => showToast(message, 'success')}
            />
          )
      )}

      {!isDriver && (
        <nav className="bottom-nav" aria-label="Navegação principal mobile">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`bottom-nav__item ${tab === t.id ? 'is-active' : ''}`}
            >
              <span>{t.id === 'main' ? 'Buscar' : 'Reservas'}</span>
            </button>
          ))}
        </nav>
      )}

      <Toast toast={toast} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
