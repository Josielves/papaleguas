import { useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { CarFront, LogOut, Mail, Phone, Save, UserRound } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors, radius, shadow } from '../theme'
import type { AppRole, Profile } from '../types'

type Props = {
  profile: Profile
  role: AppRole
  onRoleChange: (role: AppRole) => void
  onProfileChange: (profile: Profile) => void
}

export function ProfileScreen({ profile, role, onRoleChange, onProfileChange }: Props) {
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [vehicleModel, setVehicleModel] = useState(profile.vehicle_model ?? '')
  const [vehiclePlate, setVehiclePlate] = useState(profile.vehicle_plate ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const next = { ...profile, name: name.trim(), phone: phone.trim(), vehicle_model: vehicleModel.trim(), vehicle_plate: vehiclePlate.trim().toUpperCase() }
    setBusy(true)
    if (supabase && profile.id !== 'demo-user') {
      const { error } = await supabase.from('profiles').update({
        name: next.name,
        phone: next.phone || null,
        vehicle_model: next.vehicle_model || null,
        vehicle_plate: next.vehicle_plate || null,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id)
      setBusy(false)
      if (error) {
        Alert.alert('Não foi possível salvar', error.message)
        return
      }
    } else {
      setBusy(false)
    }
    onProfileChange(next)
    Alert.alert('Perfil atualizado', 'Seus dados foram salvos.')
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Seu perfil</Text>
      <Text style={styles.subtitle}>Dados de contato e informações do veículo.</Text>

      <View style={styles.identity}>
        {profile.avatar_url
          ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          : <View style={styles.avatarFallback}><UserRound size={34} color={colors.blue} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.role}>{role === 'driver' ? 'Motorista' : 'Passageiro'}</Text>
        </View>
      </View>

      <View style={styles.segmented}>
        <ModeButton label="Passageiro" active={role === 'passenger'} onPress={() => onRoleChange('passenger')} />
        <ModeButton label="Motorista" active={role === 'driver'} onPress={() => onRoleChange('driver')} />
      </View>

      <View style={styles.form}>
        <Field icon={<UserRound size={18} color={colors.primary} />} label="Nome"><TextInput style={styles.input} value={name} onChangeText={setName} /></Field>
        <Field icon={<Phone size={18} color={colors.primary} />} label="Contato"><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
        <Field icon={<Mail size={18} color={colors.primary} />} label="E-mail"><TextInput style={[styles.input, styles.inputDisabled]} value={profile.email ?? ''} editable={false} /></Field>
        <Field icon={<CarFront size={18} color={colors.primary} />} label="Modelo do carro"><TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Ex.: Honda Civic" placeholderTextColor={colors.textMuted} /></Field>
        <Field icon={<CarFront size={18} color={colors.primary} />} label="Placa"><TextInput style={styles.input} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" placeholder="ABC-1D23" placeholderTextColor={colors.textMuted} /></Field>
        <Pressable style={styles.save} onPress={save} disabled={busy}><Save size={18} color="#FFFFFF" /><Text style={styles.saveText}>{busy ? 'Salvando...' : 'Salvar alterações'}</Text></Pressable>
      </View>

      {supabase && profile.id !== 'demo-user' && (
        <Pressable style={styles.logout} onPress={() => supabase?.auth.signOut()}><LogOut size={18} color={colors.coral} /><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
      )}
    </ScrollView>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <View style={styles.field}><View style={styles.fieldLabel}>{icon}<Text style={styles.label}>{label}</Text></View>{children}</View>
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.mode, active && styles.modeActive]} onPress={onPress}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 110, gap: 14 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  name: { color: colors.text, fontSize: 19, fontWeight: '900' },
  role: { marginTop: 3, color: colors.primary, fontSize: 13, fontWeight: '800' },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.medium, backgroundColor: colors.surfaceMuted },
  mode: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  modeActive: { backgroundColor: colors.surface, ...shadow },
  modeText: { color: colors.textMuted, fontWeight: '800' },
  modeTextActive: { color: colors.primaryDark },
  form: { gap: 13, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface },
  field: { gap: 7 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800' },
  input: { height: 47, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, color: colors.text, backgroundColor: colors.background },
  inputDisabled: { color: colors.textMuted, backgroundColor: colors.surfaceMuted },
  save: { height: 48, marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.medium, backgroundColor: colors.primary },
  saveText: { color: '#FFFFFF', fontWeight: '900' },
  logout: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#FECDD3', borderRadius: radius.medium, backgroundColor: '#FFF1F2' },
  logoutText: { color: colors.coral, fontWeight: '900' },
})
