import { useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { BadgeCheck, BusFront, CarFront, LogOut, Mail, Phone, Save, Search, UserRound } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { isValidVehiclePlate, lookupVehicleByPlate, normalizeVehiclePlate } from '../services/vehicleLookup'
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
  const [vehicleBrand, setVehicleBrand] = useState(profile.vehicle_brand ?? '')
  const [vehicleModel, setVehicleModel] = useState(profile.vehicle_model ?? '')
  const [vehiclePlate, setVehiclePlate] = useState(profile.vehicle_plate ?? '')
  const [vehicleColor, setVehicleColor] = useState(profile.vehicle_color ?? '')
  const [vehicleYear, setVehicleYear] = useState(profile.vehicle_year ? String(profile.vehicle_year) : '')
  const [vehicleModelYear, setVehicleModelYear] = useState(profile.vehicle_model_year ? String(profile.vehicle_model_year) : '')
  const [vehicleType, setVehicleType] = useState<'car' | 'van'>(profile.vehicle_type === 'van' ? 'van' : 'car')
  const [vehicleCapacity, setVehicleCapacity] = useState(String(profile.vehicle_capacity ?? 6))
  const [verifiedAt, setVerifiedAt] = useState<string | null>(profile.vehicle_lookup_verified_at ?? null)
  const [lookingUp, setLookingUp] = useState(false)
  const [busy, setBusy] = useState(false)

  const chooseVehicleType = (type: 'car' | 'van') => {
    const current = Number(vehicleCapacity) || (type === 'van' ? 15 : 4)
    const capacity = type === 'van'
      ? Math.min(20, Math.max(4, current))
      : Math.min(8, Math.max(1, current))
    setVehicleType(type)
    setVehicleCapacity(String(capacity))
  }

  const lookupVehicle = async () => {
    const plate = normalizeVehiclePlate(vehiclePlate)
    setVehiclePlate(plate)
    if (!isValidVehiclePlate(plate)) {
      Alert.alert('Placa inválida', 'Use o formato antigo ABC1234 ou Mercosul ABC1D23.')
      return
    }

    setLookingUp(true)
    try {
      const vehicle = await lookupVehicleByPlate(plate)
      setVehicleBrand(vehicle.brand ?? '')
      setVehicleModel(vehicle.model ?? '')
      setVehicleColor(vehicle.color ?? '')
      setVehicleYear(vehicle.year ? String(vehicle.year) : '')
      setVehicleModelYear(vehicle.modelYear ? String(vehicle.modelYear) : '')
      setVehicleType(vehicle.type)
      setVehicleCapacity(String(vehicle.suggestedCapacity))
      setVerifiedAt(vehicle.verifiedAt)
      Alert.alert('Veículo identificado', 'Confira o tipo e a capacidade de passageiros antes de salvar.')
    } catch (error) {
      Alert.alert('Não foi possível consultar', error instanceof Error ? error.message : 'Tente novamente em instantes.')
    } finally {
      setLookingUp(false)
    }
  }

  const save = async () => {
    const capacity = Number(vehicleCapacity)
    if (role === 'driver') {
      if (!isValidVehiclePlate(vehiclePlate)) {
        Alert.alert('Placa inválida', 'Consulte ou informe uma placa válida antes de salvar.')
        return
      }
      const min = vehicleType === 'van' ? 4 : 1
      const max = vehicleType === 'van' ? 20 : 8
      if (!Number.isInteger(capacity) || capacity < min || capacity > max) {
        Alert.alert('Capacidade inválida', `Informe entre ${min} e ${max} passageiros.`)
        return
      }
    }

    const next: Profile = {
      ...profile,
      name: name.trim(),
      phone: phone.trim(),
      vehicle_brand: vehicleBrand.trim() || null,
      vehicle_model: vehicleModel.trim() || null,
      vehicle_plate: normalizeVehiclePlate(vehiclePlate) || null,
      vehicle_color: vehicleColor.trim() || null,
      vehicle_year: Number(vehicleYear) || null,
      vehicle_model_year: Number(vehicleModelYear) || null,
      vehicle_type: vehicleType,
      vehicle_capacity: capacity || 6,
      vehicle_lookup_verified_at: verifiedAt,
    }
    setBusy(true)
    if (supabase && profile.id !== 'demo-user') {
      const { error } = await supabase.from('profiles').update({
        name: next.name,
        phone: next.phone || null,
        vehicle_brand: next.vehicle_brand,
        vehicle_model: next.vehicle_model,
        vehicle_plate: next.vehicle_plate,
        vehicle_color: next.vehicle_color,
        vehicle_year: next.vehicle_year,
        vehicle_model_year: next.vehicle_model_year,
        vehicle_type: next.vehicle_type,
        vehicle_capacity: next.vehicle_capacity,
        vehicle_lookup_verified_at: next.vehicle_lookup_verified_at,
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
    Alert.alert('Perfil atualizado', 'Os dados e a capacidade do veículo foram salvos.')
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
      </View>

      {role === 'driver' && (
        <View style={styles.form}>
          <View style={styles.vehicleHeader}>
            <View style={{ flex: 1 }}><Text style={styles.vehicleTitle}>Veículo principal</Text><Text style={styles.vehicleCaption}>Consulte a placa e confirme a lotação.</Text></View>
            {verifiedAt && <BadgeCheck size={21} color={colors.primary} />}
          </View>

          <Field icon={<CarFront size={18} color={colors.primary} />} label="Placa">
            <View style={styles.lookupRow}>
              <TextInput
                style={[styles.input, styles.lookupInput]}
                value={vehiclePlate}
                onChangeText={(value) => { setVehiclePlate(value.toUpperCase()); setVerifiedAt(null) }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                placeholder="ABC1D23"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.lookupButton} onPress={lookupVehicle} disabled={lookingUp} accessibilityLabel="Consultar placa">
                <Search size={19} color="#FFFFFF" />
                <Text style={styles.lookupText}>{lookingUp ? 'Buscando' : 'Consultar'}</Text>
              </Pressable>
            </View>
          </Field>

          <View style={styles.vehicleTypes}>
            <VehicleTypeButton type="car" active={vehicleType === 'car'} onPress={() => chooseVehicleType('car')} />
            <VehicleTypeButton type="van" active={vehicleType === 'van'} onPress={() => chooseVehicleType('van')} />
          </View>

          <Field icon={<CarFront size={18} color={colors.primary} />} label="Marca"><TextInput style={styles.input} value={vehicleBrand} onChangeText={setVehicleBrand} placeholder="Ex.: Renault" placeholderTextColor={colors.textMuted} /></Field>
          <Field icon={<CarFront size={18} color={colors.primary} />} label="Modelo"><TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Ex.: Master Executive" placeholderTextColor={colors.textMuted} /></Field>

          <View style={styles.twoColumns}>
            <View style={{ flex: 1 }}><Field label="Cor"><TextInput style={styles.input} value={vehicleColor} onChangeText={setVehicleColor} placeholder="Prata" placeholderTextColor={colors.textMuted} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Passageiros"><TextInput style={styles.input} value={vehicleCapacity} onChangeText={setVehicleCapacity} keyboardType="number-pad" /></Field></View>
          </View>
          <View style={styles.twoColumns}>
            <View style={{ flex: 1 }}><Field label="Ano fabricação"><TextInput style={styles.input} value={vehicleYear} onChangeText={setVehicleYear} keyboardType="number-pad" placeholder="2022" placeholderTextColor={colors.textMuted} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Ano modelo"><TextInput style={styles.input} value={vehicleModelYear} onChangeText={setVehicleModelYear} keyboardType="number-pad" placeholder="2023" placeholderTextColor={colors.textMuted} /></Field></View>
          </View>
          <Text style={styles.hint}>Confirme a capacidade no documento do veículo. A consulta da placa não informa a lotação com segurança.</Text>
        </View>
      )}

      <Pressable style={styles.save} onPress={save} disabled={busy || lookingUp}><Save size={18} color="#FFFFFF" /><Text style={styles.saveText}>{busy ? 'Salvando...' : 'Salvar alterações'}</Text></Pressable>

      {supabase && profile.id !== 'demo-user' && (
        <Pressable style={styles.logout} onPress={() => supabase?.auth.signOut()}><LogOut size={18} color={colors.coral} /><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
      )}
    </ScrollView>
  )
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return <View style={styles.field}><View style={styles.fieldLabel}>{icon}<Text style={styles.label}>{label}</Text></View>{children}</View>
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.mode, active && styles.modeActive]} onPress={onPress}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>
}

function VehicleTypeButton({ type, active, onPress }: { type: 'car' | 'van'; active: boolean; onPress: () => void }) {
  const Icon = type === 'van' ? BusFront : CarFront
  return (
    <Pressable style={[styles.vehicleType, active && styles.vehicleTypeActive]} onPress={onPress}>
      <Icon size={20} color={active ? colors.primary : colors.textMuted} />
      <View><Text style={[styles.vehicleTypeTitle, active && styles.vehicleTypeTitleActive]}>{type === 'van' ? 'Van' : 'Carro'}</Text><Text style={styles.vehicleTypeCaption}>{type === 'van' ? '4 a 20 passageiros' : '1 a 8 passageiros'}</Text></View>
    </Pressable>
  )
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
  fieldLabel: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800' },
  input: { height: 47, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, color: colors.text, backgroundColor: colors.background },
  inputDisabled: { color: colors.textMuted, backgroundColor: colors.surfaceMuted },
  vehicleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  vehicleCaption: { marginTop: 2, color: colors.textMuted, fontSize: 12 },
  lookupRow: { flexDirection: 'row', gap: 8 },
  lookupInput: { flex: 1 },
  lookupButton: { minWidth: 112, height: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.medium, backgroundColor: colors.primary },
  lookupText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  vehicleTypes: { flexDirection: 'row', gap: 8 },
  vehicleType: { flex: 1, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.background },
  vehicleTypeActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  vehicleTypeTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  vehicleTypeTitleActive: { color: colors.primaryDark },
  vehicleTypeCaption: { color: colors.textMuted, fontSize: 9 },
  twoColumns: { flexDirection: 'row', gap: 9 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  save: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.medium, backgroundColor: colors.primary },
  saveText: { color: '#FFFFFF', fontWeight: '900' },
  logout: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#FECDD3', borderRadius: radius.medium, backgroundColor: '#FFF1F2' },
  logoutText: { color: colors.coral, fontWeight: '900' },
})
