import { useState } from 'react'
import { ArrowRight, CarFront, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { signIn, signUp } from '../lib/supabase'
import Logo from './Logo'

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [accountType, setAccountType] = useState('passenger') // 'passenger' | 'driver'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn({ email, password })
        if (error) throw error
      } else {
        if (!name.trim()) throw new Error('Informe seu nome.')
        if (password.length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.')
        const { error } = await signUp({ email, password, name, accountType, phone })
        if (error) throw error
      }
      onAuthed?.()
    } catch (err) {
      setError(translateError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label="Papa-léguas">
        <Logo />
        <div className="auth-brand__message">
          <p className="eyebrow">Mobilidade que acompanha você</p>
          <h1>Seu caminho,<br />no seu ritmo.</h1>
          <p>Encontre uma rota, escolha seu lugar e acompanhe a viagem de ponta a ponta.</p>
        </div>
        <div className="auth-brand__features" aria-label="Recursos principais">
          <span><MapPin size={17} aria-hidden="true" /> Rotas em tempo real</span>
          <span><ShieldCheck size={17} aria-hidden="true" /> Reserva segura</span>
        </div>
      </section>

      <section className="auth-shell">
        <div className="auth-shell__header">
          <p className="eyebrow">Bem-vindo ao Papa-léguas</p>
          <h2>{mode === 'login' ? 'Entre para continuar' : 'Crie sua conta'}</h2>
          <p>{mode === 'login' ? 'Acesse suas rotas, reservas e mensagens.' : 'Escolha como você quer viajar com a gente.'}</p>
        </div>

        <div className="nav-tabs auth-tabs">
        <button
          type="button"
          className={`nav-tab ${mode === 'login' ? 'is-active' : ''}`}
          style={{ flex: 1 }}
          onClick={() => { setMode('login'); setError('') }}
        >
          Entrar
        </button>
        <button
          type="button"
          className={`nav-tab ${mode === 'signup' ? 'is-active' : ''}`}
          style={{ flex: 1 }}
          onClick={() => { setMode('signup'); setError('') }}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label">Eu quero</label>
              <div className="account-type-grid">
                <button
                  type="button"
                  className={`account-type-card ${accountType === 'passenger' ? 'is-selected' : ''}`}
                  onClick={() => setAccountType('passenger')}
                >
                  <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserRound size={19} /> Pegar carona</h3>
                  <p style={{ fontSize: '0.8125rem' }}>Reservar assento em rotas abertas</p>
                </button>
                <button
                  type="button"
                  className={`account-type-card ${accountType === 'driver' ? 'is-selected' : ''}`}
                  onClick={() => setAccountType('driver')}
                >
                  <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CarFront size={19} /> Dirigir</h3>
                  <p style={{ fontSize: '0.8125rem' }}>Criar rotas e levar passageiros</p>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label" htmlFor="name">Nome completo</label>
              <input
                id="name"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como podemos te chamar"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label" htmlFor="phone">WhatsApp / Telefone</label>
              <input
                id="phone"
                className="input"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(45) 99999-9999"
              />
              <p style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>
                Usado para motorista e passageiro se contatarem pelo WhatsApp.
              </p>
            </div>
          </>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label className="field-label" htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            required
          />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label className="field-label" htmlFor="password">Senha</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: '1.25rem' }}>
            ⚠ {error}
          </div>
        )}

        <button className="btn btn-primary btn-block auth-submit" type="submit" disabled={loading}>
          <span>{loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</span>
          {!loading && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>
      </section>
    </main>
  )
}

function translateError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('user already registered')) return 'Já existe uma conta com esse e-mail.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('password should be at least')) return 'A senha é muito curta.'
  return message || 'Algo deu errado. Tente novamente.'
}
