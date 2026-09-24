import { useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ArrowRight, BusFront, CarFront, CircleDollarSign, MapPin, Play, Route as RouteIcon, UsersRound } from 'lucide-react-native'
import { LiveRouteMap } from '../components/LiveRouteMap'
import { useDriverLocation } from '../hooks/useDriverLocation'
import { supabase } from '../lib/supabase'
import { colors, radius, shadow } from '../theme'
import type { Profile, Route } from '../types'

type Props = {
  profile: Profile
  routes: Route[]
  loading: boolean
  onRefresh: () => void
}

export function DriverDashboard({ profile, routes, loading, onRefresh }: Props) {
  const firstActive = routes.find((route) => (
    Boolean(route.started_at) && ['open', 'full'].includes(route.status)
  )) ?? null
  const [activeRouteId, setActiveRouteId] = useState<string | null>(firstActive?.id ?? null)
  const trackingRouteId = activeRouteId ?? firstActive?.id ?? null
  const activeRoute = routes.find((route) => route.id === trackingRouteId) ?? routes[0] ?? null
  const tracking = useDriverLocation(trackingRouteId, profile.id, Boolean(trackingRouteId))

  const metrics = useMemo(() => {
    const confirmed = routes.flatMap((route) => route.bookings ?? []).filter((booking) => booking.status !== 'cancelled')
    const seats = routes.reduce((sum, route) => sum + route.total_seats, 0)
    const occupied = confirmed.length
    return {
      passengers: occupied,
      revenue: confirmed.reduce((sum, booking) => sum + Number(booking.amount ?? 10), 0),
      occupancy: seats ? Math.round((occupied / seats) * 100) : 0,
    }
  }, [routes])

  const startRoute = async (route: Route) => {
    if (route.id.startsWith('demo-')) {
      setActiveRouteId(route.id)
      Alert.alert('Rota iniciada', 'A localização em tempo real está ativa nesta demonstração.')
      return
    }
    if (!supabase) return
    const { error } = await supabase.rpc('start_route', { p_route_id: route.id, p_driver_id: profile.id })
    if (error) Alert.alert('Não foi possível iniciar', error.message)
    else setActiveRouteId(route.id)
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.eyebrow}>PAINEL DO MOTORISTA</Text>
      <Text style={styles.title}>Olá, {profile.name.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>Controle rotas, passageiros e a operação da próxima saída.</Text>

      <View style={styles.metrics}>
        <Metric icon={<UsersRound size={20} color={colors.blue} />} value={String(metrics.passengers)} label="Passageiros" />
        <Metric icon={<CircleDollarSign size={20} color={colors.primary} />} value={`R$ ${metrics.revenue}`} label="Receita" />
        <Metric icon={<RouteIcon size={20} color={colors.amber} />} value={`${metrics.occupancy}%`} label="Ocupação" />
      </View>

      {activeRoute && (
        <View style={styles.mapBlock}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Operação em tempo real</Text>
              <Text style={styles.sectionCaption}>{short(activeRoute.origin_address)} → {short(activeRoute.destination_address)}</Text>
            </View>
            <View style={[styles.broadcast, !tracking.broadcasting && styles.broadcastIdle]}>
              <View style={[styles.broadcastDot, !tracking.broadcasting && styles.broadcastDotIdle]} />
              <Text style={styles.broadcastText}>{tracking.broadcasting ? 'Transmitindo' : 'Pronta'}</Text>
            </View>
          </View>
          <LiveRouteMap route={activeRoute} height={275} />
          {tracking.error && <Text style={styles.error}>{tracking.error}</Text>}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximas saídas</Text>
        <Text style={styles.sectionCaption}>{routes.length} rotas</Text>
      </View>

      {routes.map((route) => {
        const passengers = route.bookings?.filter((booking) => booking.status !== 'cancelled').length ?? 0
        const VehicleIcon = route.vehicle_type === 'van' ? BusFront : CarFront
        return (
          <View key={route.id} style={[styles.routeCard, route.id === trackingRouteId && styles.routeCardActive]}>
            <View style={styles.routeTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeTitle}>{short(route.origin_address)} → {short(route.destination_address)}</Text>
                <Text style={styles.routeTime}>{formatDate(route.departure_time)}</Text>
              </View>
              <Text style={styles.status}>{route.id === trackingRouteId ? 'EM CURSO' : route.status.toUpperCase()}</Text>
            </View>
            <View style={styles.routeInfo}>
              <View style={styles.info}><UsersRound size={16} color={colors.textMuted} /><Text style={styles.infoText}>{passengers}/{route.total_seats}</Text></View>
              <View style={styles.info}><VehicleIcon size={16} color={colors.textMuted} /><Text style={styles.infoText}>{route.vehicle_model ?? profile.vehicle_model ?? 'Veículo'}{route.vehicle_capacity ? ` · ${route.vehicle_capacity} lugares` : ''}</Text></View>
              <View style={styles.info}><MapPin size={16} color={colors.textMuted} /><Text style={styles.infoText}>{short(route.destination_address)}</Text></View>
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.secondary} onPress={() => setActiveRouteId(route.id)}>
                <Text style={styles.secondaryText}>Ver operação</Text><ArrowRight size={18} color={colors.primary} />
              </Pressable>
              {route.id !== trackingRouteId && (
                <Pressable style={styles.primary} onPress={() => startRoute(route)}>
                  <Play size={17} color="#FFFFFF" fill="#FFFFFF" /><Text style={styles.primaryText}>Iniciar</Text>
                </Pressable>
              )}
            </View>
          </View>
        )
      })}

      {routes.length === 0 && (
        <View style={styles.empty}>
          <RouteIcon size={28} color={colors.primary} />
          <Text style={styles.emptyTitle}>Nenhuma rota programada</Text>
          <Text style={styles.sectionCaption}>Crie sua primeira rota pelo painel web administrativo.</Text>
        </View>
      )}
    </ScrollView>
  )
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

const short = (value: string) => value.split(',')[0]
const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 110, gap: 14 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 104, justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  metricValue: { color: colors.text, fontSize: 19, fontWeight: '900' },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  mapBlock: { gap: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 5 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sectionCaption: { color: colors.textMuted, fontSize: 12 },
  broadcast: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.primarySoft },
  broadcastIdle: { backgroundColor: colors.surfaceMuted },
  broadcastDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  broadcastDotIdle: { backgroundColor: colors.textMuted },
  broadcastText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  error: { color: '#9F1239', fontSize: 12 },
  routeCard: { gap: 12, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface },
  routeCardActive: { borderColor: colors.primary, backgroundColor: '#F0FDFA' },
  routeTop: { flexDirection: 'row', gap: 10 },
  routeTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  routeTime: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
  status: { color: colors.primaryDark, fontSize: 9, fontWeight: '900' },
  routeInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line },
  secondary: { height: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.primary },
  secondaryText: { color: colors.primary, fontWeight: '800' },
  primary: { height: 41, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.medium, backgroundColor: colors.primary },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderRadius: radius.large, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontWeight: '900' },
})
