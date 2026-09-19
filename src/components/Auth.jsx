import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [accountType, setAccountType] = useState('passenger') // 'passenger' | 'driver'
  const [name, setName] = useState('')
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
        const { error } = await signUp({ email, password, name, accountType })
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
    <div className="auth-shell">
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div className="brand" style={{ justifyContent: 'center', fontSize: '1.5rem' }}>
          Papaleguas
        </div>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem' }}>
          Caronas fixas entre regiões da cidade
        </p>
      </div>

      <div className="route-divider" style={{ marginBottom: '1.5rem' }} />

      <div className="nav-tabs" style={{ marginBottom: '1.5rem' }}>
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
                  <h3 style={{ marginBottom: '0.25rem' }}>🧑 Pegar carona</h3>
                  <p style={{ fontSize: '0.8125rem' }}>Reservar assento em rotas abertas</p>
                </button>
                <button
                  type="button"
                  className={`account-type-card ${accountType === 'driver' ? 'is-selected' : ''}`}
                  onClick={() => setAccountType('driver')}
                >
                  <h3 style={{ marginBottom: '0.25rem' }}>🚗 Dirigir</h3>
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

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
    </div>
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
