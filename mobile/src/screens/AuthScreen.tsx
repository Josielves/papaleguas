import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { CarFront, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native'
import { Brand } from '../components/Brand'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, shadow } from '../theme'
import type { AppRole } from '../types'

export function AuthScreen() {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brandStage}>
          <View style={styles.brandBadge}><Brand compact /></View>
          <Text style={styles.brandName}>Papa-léguas</Text>
          <Text style={styles.brandLine}>RÁPIDO. DIRETO. CONFIÁVEL.</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>{creating ? 'Chegue junto.' : 'Bem-vindo de volta'}</Text>
          <Text style={styles.subtitle}>{creating ? 'Crie sua conta e escolha como quer viajar.' : 'Entre para encontrar sua próxima rota.'}</Text>
        </View>

        <View style={styles.panel}>
        {creating && (
          <>
            <Text style={styles.label}>Nome</Text>
            <View style={styles.inputShell}><UserRound size={18} color={colors.textMuted} /><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Como podemos chamar você?" placeholderTextColor={colors.textMuted} /></View>
            <Text style={styles.label}>Quero usar como</Text>
            <View style={styles.roleRow}>
              <RoleButton active={role === 'passenger'} icon={<UserRound size={20} color={role === 'passenger' ? colors.text : colors.primaryDark} />} label="Passageiro" onPress={() => setRole('passenger')} />
              <RoleButton active={role === 'driver'} icon={<CarFront size={20} color={role === 'driver' ? colors.text : colors.primaryDark} />} label="Motorista" onPress={() => setRole('driver')} />
            </View>
          </>
        )}
        <Text style={styles.label}>E-mail</Text>
        <View style={styles.inputShell}><Mail size={18} color={colors.textMuted} /><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" placeholderTextColor={colors.textMuted} /></View>
        <Text style={styles.label}>Senha</Text>
        <View style={styles.inputShell}>
          <LockKeyhole size={18} color={colors.textMuted} />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="Mínimo de 6 caracteres" placeholderTextColor={colors.textMuted} />
          <Pressable style={styles.eye} onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
            {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
          </Pressable>
        </View>

        <Pressable style={styles.submit} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.submitText}>{creating ? 'Criar conta' : 'Entrar'}</Text>}
        </Pressable>
        <Pressable style={styles.switch} onPress={() => setCreating((value) => !value)}>
          <Text style={styles.switchHint}>{creating ? 'Já faz parte?' : 'Primeira viagem?'}</Text>
          <Text style={styles.switchText}>{creating ? ' Entrar' : ' Criar uma conta'}</Text>
        </Pressable>
        </View>
      </ScrollView>
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
  keyboard: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28, backgroundColor: colors.background },
  brandStage: { alignItems: 'center', marginBottom: 30 },
  brandBadge: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: colors.primary },
  brandName: { marginTop: 10, color: colors.text, fontSize: 20, fontFamily: fonts.extraBold },
  brandLine: { marginTop: 3, color: colors.primaryDark, fontSize: 9, fontFamily: fonts.extraBold },
  hero: { gap: 6, marginBottom: 22 },
  title: { color: colors.text, fontSize: 29, lineHeight: 34, fontFamily: fonts.extraBold, letterSpacing: 0 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  panel: { gap: 9 },
  label: { marginTop: 4, color: colors.text, fontSize: 12, fontFamily: fonts.bold },
  inputShell: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.surface },
  input: { flex: 1, height: 48, color: colors.text, fontFamily: fonts.regular },
  eye: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  roleRow: { flexDirection: 'row', gap: 9 },
  roleButton: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.surface },
  roleButtonActive: { backgroundColor: colors.primary },
  roleText: { color: colors.primaryDark, fontFamily: fonts.bold },
  roleTextActive: { color: colors.text },
  submit: { height: 52, marginTop: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, ...shadow },
  submitText: { color: colors.primary, fontSize: 15, fontFamily: fonts.extraBold },
  switch: { padding: 12, flexDirection: 'row', justifyContent: 'center' },
  switchHint: { color: colors.textMuted, fontFamily: fonts.medium },
  switchText: { color: colors.primaryDark, fontFamily: fonts.extraBold },
})
