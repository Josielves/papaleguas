import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ArrowLeft, BusFront, CarFront, MapPin, ShieldCheck, Star } from 'lucide-react-native'
import { LiveRouteMap } from '../components/LiveRouteMap'
import { SeatMap } from '../components/SeatMap'
import { supabase } from '../lib/supabase'
import { colors, radius, shadow } from '../theme'
import type { Profile, Route, Seat } from '../types'

type Props = {
  route: Route
  profile: Profile
  onBack: () => void
}

export function RouteDetails({ route, profile, onBack }: Props) {
  const VehicleIcon = route.vehicle_type === 'van' ? BusFront : CarFront
  const initialSeats = useMemo<Seat[]>(() => route.seats?.length
    ? route.seats
    : Array.from({ length: route.total_seats }, (_, index) => ({
        id: `${route.id}-${index + 1}`,
        seat_number: index + 1,
        status: 'available' as const,
      })), [route])
  const [seats, setSeats] = useState(initialSeats)
  const [selected, setSelected] = useState<number | null>(null)
  const [pickupAddress, setPickupAddress] = useState(route.origin_address)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!selected) {
      Alert.alert('Escolha um assento', 'Selecione um lugar disponível antes de confirmar.')
      return
    }
    setBusy(true)
    if (supabase && !route.id.startsWith('demo-')) {
      const { error } = await supabase.rpc('reserve_seat', {
        p_route_id: route.id,
        p_seat_number: selected,
        p_passenger_id: profile.id,
        p_pickup_address: pickupAddress.trim() || route.origin_address,
        p_pickup_lat: route.origin_lat ?? null,
        p_pickup_lng: route.origin_lng ?? null,
      })
      setBusy(false)
      if (error) {
        Alert.alert('Não foi possível reservar', error.message)
        return
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 350))
      setBusy(false)
    }
    setSeats((current) => current.map((seat) => seat.seat_number === selected ? { ...seat, status: 'reserved' } : seat))
    Alert.alert('Reserva confirmada', `Assento ${selected} reservado. Você receberá avisos sobre a viagem.`)
    setSelected(null)
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={onBack} accessibilityLabel="Voltar">
        <ArrowLeft size={21} color={colors.text} />
        <Text style={styles.backText}>Procurar viagem</Text>
      </Pressable>

      <LiveRouteMap route={route} height={300} />

      <View style={styles.summary}>
        <View style={styles.pathRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.path}>{short(route.origin_address)} → {short(route.destination_address)}</Text>
            <Text style={styles.departure}>{formatDate(route.departure_time)}</Text>
          </View>
          <Text style={styles.price}>R$ {Number(route.price ?? 10).toFixed(2).replace('.', ',')}</Text>
        </View>

        <View style={styles.driverRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{route.driver?.name?.[0] ?? 'P'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driver}>{route.driver?.name ?? 'Motorista Papaleguas'}</Text>
            <View style={styles.inline}><VehicleIcon size={15} color={colors.textMuted} /><Text style={styles.muted}>{[route.vehicle_brand, route.vehicle_model].filter(Boolean).join(' ') || 'Veículo cadastrado'}{route.vehicle_capacity ? ` · ${route.vehicle_capacity} lugares` : ''}</Text></View>
          </View>
          <View style={styles.rating}><Star size={15} color={colors.amber} fill={colors.amber} /><Text style={styles.ratingText}>4,9</Text></View>
        </View>
        <View style={styles.safety}><ShieldCheck size={17} color={colors.primary} /><Text style={styles.safetyText}>Perfil e veículo verificados</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Escolha seu assento</Text>
        <SeatMap seats={seats} selected={selected} onSelect={setSelected} vehicleType={route.vehicle_type === 'van' ? 'van' : 'car'} />
      </View>

      <View style={styles.section}>
        <View style={styles.inline}><MapPin size={18} color={colors.primary} /><Text style={styles.sectionTitle}>Embarque</Text></View>
        <TextInput style={styles.input} value={pickupAddress} onChangeText={setPickupAddress} placeholder="Endereço de embarque" placeholderTextColor={colors.textMuted} />
      </View>

      <View style={styles.confirmBar}>
        <View>
          <Text style={styles.confirmLabel}>{selected ? `Assento ${selected}` : 'Selecione um assento'}</Text>
          <Text style={styles.confirmPrice}>R$ {Number(route.price ?? 10).toFixed(2).replace('.', ',')}</Text>
        </View>
        <Pressable style={[styles.confirm, (!selected || busy) && styles.confirmDisabled]} disabled={!selected || busy} onPress={confirm}>
          <Text style={styles.confirmText}>{busy ? 'Confirmando...' : 'Confirmar reserva'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const short = (value: string) => value.split(',')[0]
const formatDate = (value: string) => {
  const date = new Date(value)
  return `${date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} • ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 120, gap: 14 },
  back: { alignSelf: 'flex-start', height: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backText: { color: colors.text, fontWeight: '800' },
  summary: { gap: 14, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  pathRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  path: { color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  departure: { marginTop: 4, color: colors.textMuted, fontSize: 13 },
  price: { color: colors.primaryDark, fontSize: 18, fontWeight: '900' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line },
  avatar: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  avatarText: { color: colors.blue, fontWeight: '900', fontSize: 17 },
  driver: { color: colors.text, fontWeight: '900' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { color: colors.textMuted, fontSize: 12 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.text, fontWeight: '900' },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, borderRadius: radius.small, backgroundColor: colors.primarySoft },
  safetyText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  section: { gap: 13, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  input: { height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, color: colors.text, backgroundColor: colors.background },
  confirmBar: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  confirmLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  confirmPrice: { color: colors.text, fontSize: 18, fontWeight: '900' },
  confirm: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.medium, backgroundColor: colors.primary },
  confirmDisabled: { backgroundColor: '#94A3B8' },
  confirmText: { color: '#FFFFFF', fontWeight: '900' },
})
