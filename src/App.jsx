import { lazy, Suspense, useEffect, useState } from 'react'
import { Armchair, Home, LogOut, MessageCircle, Route as RouteIcon, Search, Settings, UserRound } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './components/Auth'
import Toast from './components/Toast'
import Logo from './components/Logo'
import NotificationCenter from './components/NotificationCenter'
import { initials } from './lib/format'

const DriverDashboard = lazy(() => import('./components/DriverDashboard'))
const OpenRoutes = lazy(() => import('./components/OpenRoutes'))
const MyBookings = lazy(() => import('./components/MyBookings'))
const EditProfile = lazy(() => import('./components/EditProfile'))

const DRIVER_TABS = [
  { id: 'main', label: 'Início', icon: Home },
  { id: 'routes', label: 'Rotas', icon: RouteIcon },
  { id: 'bookings', label: 'Reservas', icon: Armchair },
  { id: 'messages', label: 'Mensagens', icon: MessageCircle },
  { id: 'profile', label: 'Perfil', icon: UserRound },
  { id: 'settings', label: 'Config.', icon: Settings },
]

const PASSENGER_TABS = [
  { id: 'main', label: 'Buscar', icon: Search },
  { id: 'bookings', label: 'Reservas', icon: Armchair },
  { id: 'profile', label: 'Perfil', icon: UserRound },
]

function Shell() {
  const { session, profile, loading, signOut, reloadProfile } = useAuth()
  const [tab, setTab] = useState('main')
  const [toast, setToast] = useState(null)
  const isDriverDesktop = useMediaQuery('(min-width: 900px)')

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
  const tabs = isDriver ? DRIVER_TABS : PASSENGER_TABS

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className={`app-shell ${isDriver ? 'app-shell--driver' : ''}`}>
      <header className={`app-header ${isDriver ? 'app-header--driver' : 'app-header--passenger'}`}>
        <div className="app-header__inner">
          <Logo />
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
            {(!isDriver || !isDriverDesktop) && (
              <NotificationCenter user={user} onNotice={(message) => showToast(message, 'success')} />
            )}
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
            <button onClick={signOut} className="btn btn-ghost"><LogOut size={16} /> Sair</button>
          </div>
        </div>
      </header>

      <Suspense fallback={<PageFallback />}>
        {isDriver ? (
          <div className="driver-workspace">
            <aside className="driver-sidebar">
              <div className="driver-sidebar__top">
                <Logo />
                {isDriverDesktop && (
                  <NotificationCenter user={user} onNotice={(message) => showToast(message, 'success')} />
                )}
              </div>

              <nav className="driver-sidebar__nav" aria-label="Painel do motorista">
                {DRIVER_TABS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={tab === item.id ? 'is-active' : ''}
                      onClick={() => setTab(item.id)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.label}
                    </button>
                  )
                })}
              </nav>

              <div className="driver-sidebar__account">
                <button type="button" className="driver-sidebar__profile" onClick={() => setTab('profile')}>
                  <span className="avatar">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.name)}
                  </span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>Motorista</small>
                  </span>
                </button>
                <button type="button" className="driver-sidebar__signout" onClick={signOut} title="Sair" aria-label="Sair"><LogOut size={17} /></button>
              </div>
            </aside>

            <div className="driver-workspace__content">
              {tab === 'profile' ? (
                <ProfilePage
                  user={user}
                  reloadProfile={reloadProfile}
                  signOut={signOut}
                  showToast={showToast}
                />
              ) : tab === 'settings' ? (
                <DriverSettings onProfile={() => setTab('profile')} onRoutes={() => setTab('routes')} onSignOut={signOut} />
              ) : (
                <DriverDashboard
                  view={tab}
                  user={user}
                  onError={(message) => showToast(message, 'error')}
                  onSuccess={(message) => showToast(message, 'success')}
                />
              )}
            </div>
          </div>
        ) : tab === 'profile' ? (
          <ProfilePage
            user={user}
            reloadProfile={reloadProfile}
            signOut={signOut}
            showToast={showToast}
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
      </Suspense>

      <nav className="bottom-nav" aria-label="Navegação principal mobile">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`bottom-nav__item ${tab === t.id ? 'is-active' : ''}`}
            >
              {Icon && <Icon className="bottom-nav__icon" size={17} aria-hidden="true" />}
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      <Toast toast={toast} />
    </div>
  )
}

function ProfilePage({ user, reloadProfile, signOut, showToast }) {
  return (
    <main className="page-container profile-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Minha conta</p>
          <h2>Perfil do usuário</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Contato, identificação e dados do veículo em um só lugar.</p>
        </div>
        <button className="btn btn-ghost profile-signout" onClick={signOut}>Sair</button>
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
  )
}

function DriverSettings({ onProfile, onRoutes, onSignOut }) {
  return (
    <main className="page-container driver-settings">
      <div className="driver-console__header">
        <div>
          <p className="eyebrow">Preferências e segurança</p>
          <h1>Configurações</h1>
          <p>Controle os dados do veículo, a localização das rotas e sua sessão.</p>
        </div>
      </div>

      <div className="driver-settings__list">
        <section className="driver-setting-row">
          <div>
            <strong>Conta e veículo</strong>
            <p>Atualize foto, contato, e-mail e os dados do carro.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onProfile}><UserRound size={17} /> Editar perfil</button>
        </section>
        <section className="driver-setting-row">
          <div>
            <strong>Localização em tempo real</strong>
            <p>A transmissão só é ativada quando você inicia ou escolhe transmitir uma rota.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onRoutes}><RouteIcon size={17} /> Gerenciar rotas</button>
        </section>
        <section className="driver-setting-row">
          <div>
            <strong>Sessão</strong>
            <p>Encerre o acesso ao painel neste dispositivo.</p>
          </div>
          <button className="btn btn-danger" type="button" onClick={onSignOut}><LogOut size={17} /> Sair da conta</button>
        </section>
      </div>
    </main>
  )
}

function PageFallback() {
  return (
    <main className="page-container" aria-live="polite">
      <div className="skeleton" style={{ height: '12rem', borderRadius: 'var(--radius-md)' }} />
    </main>
  )
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
