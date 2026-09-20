import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    if (!userId) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp({ email, password, fullName, role, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: fullName, account_type: role, phone } },
    })
    if (error) throw error

    if (data.user) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ name: fullName, account_type: role, phone })
        .eq('id', data.user.id)
      if (updateError) throw updateError
      await loadProfile(data.user.id)
    }
    return data
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const normalizedProfile = profile
    ? { ...profile, role: profile.account_type, full_name: profile.name }
    : null

  return (
    <AuthContext.Provider value={{ session, profile: normalizedProfile, loading, signUp, signIn, signOut, reloadProfile: () => loadProfile(session?.user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
