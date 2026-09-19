import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { signUp, signIn } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [role, setRole] = useState('cliente')
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUp({ email: form.email, password: form.password, fullName: form.fullName, role, phone: form.phone })
      } else {
        await signIn({ email: form.email, password: form.password })
      }
    } catch (err) {
      setError(err.message || 'Algo deu errado. Tenta de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7fbef] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-[#0b0f08] mb-1">Papaléguas</h1>
        <p className="text-[#0b0f08]/60 mb-8">
          {mode === 'login' ? 'Entra na sua conta' : 'Cria sua conta pra começar'}
        </p>

        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              type="button"
              onClick={() => setRole('cliente')}
              className={`py-3 rounded-xl font-medium transition ${
                role === 'cliente' ? 'bg-[#c4ff00] text-[#0b0f08]' : 'bg-white text-[#0b0f08]/60 border border-[#0b0f08]/10'
              }`}
            >
              Sou passageiro
            </button>
            <button
              type="button"
              onClick={() => setRole('motorista')}
              className={`py-3 rounded-xl font-medium transition ${
                role === 'motorista' ? 'bg-[#c4ff00] text-[#0b0f08]' : 'bg-white text-[#0b0f08]/60 border border-[#0b0f08]/10'
              }`}
            >
              Sou motorista
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <input
                required
                placeholder="Nome completo"
                value={form.fullName}
                onChange={update('fullName')}
                className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white outline-none focus:border-[#c4ff00]"
              />
              <input
                required
                placeholder="Telefone (WhatsApp)"
                value={form.phone}
                onChange={update('phone')}
                className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white outline-none focus:border-[#c4ff00]"
              />
            </>
          )}
          <input
            required
            type="email"
            placeholder="E-mail"
            value={form.email}
            onChange={update('email')}
            className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white outline-none focus:border-[#c4ff00]"
          />
          <input
            required
            type="password"
            minLength={6}
            placeholder="Senha"
            value={form.password}
            onChange={update('password')}
            className="w-full px-4 py-3 rounded-xl border border-[#0b0f08]/10 bg-white outline-none focus:border-[#c4ff00]"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0b0f08] text-[#c4ff00] font-semibold disabled:opacity-50"
          >
            {loading ? 'Aguenta aí…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="mt-4 text-sm text-[#0b0f08]/60 underline w-full text-center"
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  )
}
