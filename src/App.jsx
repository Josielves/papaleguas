import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './components/Auth'
import DriverDashboard from './components/DriverDashboard'
import OpenRoutes from './components/OpenRoutes'
import MyBookings from './components/MyBookings'
import Toast from './components/Toast'
import Logo from './components/Logo'
import EditProfile from './components/EditProfile'
import NotificationCenter from './components/NotificationCenter'
import { initials } from './lib/format'

function Shell() {
  const { session, profile, loading, signOut, reloadProfile } = useAuth()
  const [tab, setTab] = useState('main')
  const [toast, setToast] = useState(null)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#0b0f08]/50">Carregando...</div>
  if (!session) return <Auth />
  if (!profile?.role) return <div className="min-h-screen flex items-center justify-center text-[#0b0f08]/50">Completando seu cadastro...</div>

  const user = {
    ...session.user,
    ...profile,
    id: session.user.id,
    email: profile.email || session.user.email,
  }
  const isDriver = profile.role === 'driver'
  const tabs = isDriver
    ? [{ id: 'main', label: 'Operação' }, { id: 'profile', label: 'Perfil' }]
    : [{ id: 'main', label: 'Buscar' }, { id: 'bookings', label: 'Reservas' }, { id: 'profile', label: 'Perfil' }]

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Logo />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
            <NotificationCenter user={user} onNotice={(message) => showToast(message, 'success')} />
            <button className="header-user" onClick={() => setTab('profile')} title="Abrir meu perfil">
              <span className="avatar">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" />
                  : initials(user.name)}
              </span>
              <span className="header-user__copy">
                <strong>{user.name}</strong>
                <small>{isDriver ? 'Motorista' : 'Passageiro'}</small>
              </span>
            </button>
            <button onClick={signOut} className="btn btn-ghost">Sair</button>
          </div>
        </div>
      </header>

      {tab === 'profile' ? (
        <main className="page-container profile-page">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Minha conta</p>
              <h2>Perfil do usuário</h2>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Contato, identificação e dados do veículo em um só lugar.</p>
            </div>
          </div>
          <div className="profile-panel">
            <EditProfile
              user={user}
              onUpdated={reloadProfile}
              onError={(message) => showToast(message, 'error')}
              onSuccess={(message) => showToast(message, 'success')}
            />
          </div>
        </main>
      ) : isDriver ? (
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

      <nav className="bottom-nav" aria-label="Navegação principal mobile">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`bottom-nav__item ${tab === t.id ? 'is-active' : ''}`}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

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
