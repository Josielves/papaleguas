import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import CreateRoute from './pages/CreateRoute'
import DriverRoutes from './pages/DriverRoutes'
import SearchRoutes from './pages/SearchRoutes'
import MyBookings from './pages/MyBookings'

function Shell() {
  const { session, profile, loading, signOut } = useAuth()
  const [tab, setTab] = useState('main')

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#0b0f08]/50">Carregando…</div>
  if (!session) return <Auth />
  if (!profile?.role) return <div className="min-h-screen flex items-center justify-center text-[#0b0f08]/50">Completando seu cadastro…</div>

  const isDriver = profile.role === 'motorista'
  const tabs = isDriver
    ? [{ id: 'main', label: 'Criar rota' }, { id: 'routes', label: 'Minhas rotas' }]
    : [{ id: 'main', label: 'Buscar' }, { id: 'bookings', label: 'Minhas reservas' }]

  return (
    <div className="min-h-screen bg-[#f7fbef]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#0b0f08]/10 bg-white">
        <span className="font-bold text-[#0b0f08]">Papaléguas</span>
        <button onClick={signOut} className="text-sm text-[#0b0f08]/60 underline">Sair</button>
      </header>

      <div className="flex gap-2 max-w-md mx-auto px-4 pt-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              tab === t.id ? 'bg-[#0b0f08] text-[#c4ff00]' : 'bg-white border border-[#0b0f08]/10 text-[#0b0f08]/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isDriver ? (
        tab === 'main' ? <CreateRoute onCreated={() => setTab('routes')} /> : <DriverRoutes />
      ) : (
        tab === 'main' ? <SearchRoutes /> : <MyBookings />
      )}
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
