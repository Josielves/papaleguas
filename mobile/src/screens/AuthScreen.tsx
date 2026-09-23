import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { CarFront, UserRound } from 'lucide-react-native'
import { Brand } from '../components/Brand'
import { supabase } from '../lib/supabase'
import { colors, radius, shadow } from '../theme'
import type { AppRole } from '../types'

export function AuthScreen() {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<AppRole>('passenger')

  const submit = async () => {
    if (!supabase || !email.trim() || password.length < 6 || (creating && !name.trim())) {
      Alert.alert('Revise os dados', 'Informe um e-mail válido e uma senha com pelo menos 6 caracteres.')
      return
    }
    setBusy(true)
    const result = creating
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim(), account_type: role } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (result.error) Alert.alert('Não foi possível entrar', result.error.message)
    else if (creating && !result.data.session) Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação para concluir seu cadastro.')
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.hero}>
        <Brand />
        <Text style={styles.title}>{creating ? 'Crie sua conta' : 'Sua próxima rota começa aqui'}</Text>
        <Text style={styles.subtitle}>Viagens locais com assento reservado, acompanhamento ao vivo e avisos no momento certo.</Text>
      </View>

      <View style={styles.panel}>
        {creating && (
          <>
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Como podemos chamar você?" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>Quero usar como</Text>
            <View style={styles.roleRow}>
              <RoleButton active={role === 'passenger'} icon={<UserRound size={20} color={role === 'passenger' ? '#FFFFFF' : colors.primary} />} label="Passageiro" onPress={() => setRole('passenger')} />
              <RoleButton active={role === 'driver'} icon={<CarFront size={20} color={role === 'driver' ? '#FFFFFF' : colors.primary} />} label="Motorista" onPress={() => setRole('driver')} />
            </View>
          </>
        )}
        <Text style={styles.label}>E-mail</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Senha</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo de 6 caracteres" placeholderTextColor={colors.textMuted} />

        <Pressable style={styles.submit} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{creating ? 'Criar conta' : 'Entrar'}</Text>}
        </Pressable>
        <Pressable style={styles.switch} onPress={() => setCreating((value) => !value)}>
          <Text style={styles.switchText}>{creating ? 'Já tenho conta' : 'Criar uma conta'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function RoleButton({ active, icon, label, onPress }: { active: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.roleButton, active && styles.roleButtonActive]} onPress={onPress}>
      {icon}
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.background },
  hero: { gap: 12, marginBottom: 22 },
  title: { color: colors.text, fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: 0 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  panel: { gap: 9, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  label: { marginTop: 4, color: colors.text, fontSize: 12, fontWeight: '800' },
  input: { height: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, color: colors.text, backgroundColor: colors.background },
  roleRow: { flexDirection: 'row', gap: 9 },
  roleButton: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.medium },
  roleButtonActive: { backgroundColor: colors.primary },
  roleText: { color: colors.primary, fontWeight: '800' },
  roleTextActive: { color: '#FFFFFF' },
  submit: { height: 50, marginTop: 10, borderRadius: radius.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  switch: { padding: 10, alignItems: 'center' },
  switchText: { color: colors.primary, fontWeight: '800' },
})
