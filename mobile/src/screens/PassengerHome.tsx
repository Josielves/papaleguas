import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ArrowRight, Armchair, Clock3, MapPin, Search } from 'lucide-react-native'
import { LiveRouteMap } from '../components/LiveRouteMap'
import { colors, radius, shadow } from '../theme'
import type { Profile, Route } from '../types'

type Props = {
  profile: Profile
  routes: Route[]
  loading: boolean
  onRefresh: () => void
  onSelectRoute: (route: Route) => void
}

export function PassengerHome({ profile, routes, loading, onRefresh, onSelectRoute }: Props) {
  const [origin, setOrigin] = useState('Centro')
  const [destination, setDestination] = useState('Região Norte')
  const [searching, setSearching] = useState(false)

  const visibleRoutes = useMemo(() => {
    if (!searching) return routes
    const words = `${origin} ${destination}`.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean)
    return routes.filter((route) => {
      const text = `${route.origin_address} ${route.destination_address}`.toLocaleLowerCase('pt-BR')
      return words.every((word) => text.includes(word) || word === 'região')
    })
  }, [routes, searching, origin, destination])

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.greeting}>Olá, {profile.name.split(' ')[0]}</Text>
      <Text style={styles.title}>Para onde você vai?</Text>

      <View style={styles.searchPanel}>
        <View style={styles.fieldRow}>
          <MapPin size={19} color={colors.primary} />
          <View style={styles.fieldCopy}>
            <Text style={styles.label}>ORIGEM</Text>
            <TextInput value={origin} onChangeText={setOrigin} style={styles.input} placeholder="Sua origem" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.connector} />
        <View style={styles.fieldRow}>
          <MapPin size={19} color={colors.coral} />
          <View style={styles.fieldCopy}>
            <Text style={styles.label}>DESTINO</Text>
            <TextInput value={destination} onChangeText={setDestination} style={styles.input} placeholder="Seu destino" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <Pressable style={styles.searchButton} onPress={() => setSearching(true)}>
          <Search size={19} color="#FFFFFF" />
          <Text style={styles.searchText}>Procurar rotas</Text>
        </Pressable>
      </View>

      {routes[0] && (
        <View style={styles.mapSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rotas perto de você</Text>
            <Text style={styles.liveLabel}>AO VIVO</Text>
          </View>
          <LiveRouteMap route={routes[0]} height={230} />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximas viagens</Text>
        <Text style={styles.resultCount}>{visibleRoutes.length} opções</Text>
      </View>

      {visibleRoutes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhuma rota com esses pontos</Text>
          <Text style={styles.emptyText}>Tente buscar por uma região ou endereço próximo.</Text>
        </View>
      )}
      {visibleRoutes.map((route) => <RouteCard key={route.id} route={route} onPress={() => onSelectRoute(route)} />)}
    </ScrollView>
  )
}

function RouteCard({ route, onPress }: { route: Route; onPress: () => void }) {
  const available = route.seats?.filter((seat) => seat.status === 'available').length ?? route.available_seats ?? 0
  return (
    <Pressable style={styles.routeCard} onPress={onPress}>
      <View style={styles.routeTop}>
        <View style={styles.routePath}>
          <Text style={styles.routeName}>{shortAddress(route.origin_address)}</Text>
          <ArrowRight size={18} color={colors.primary} />
          <Text style={styles.routeName}>{shortAddress(route.destination_address)}</Text>
        </View>
        <Text style={styles.price}>R$ {Number(route.price ?? 10).toFixed(2).replace('.', ',')}</Text>
      </View>
      <View style={styles.routeMeta}>
        <View style={styles.metaItem}><Clock3 size={15} color={colors.textMuted} /><Text style={styles.metaText}>{formatDeparture(route.departure_time)}</Text></View>
        <View style={styles.metaItem}><Armchair size={15} color={colors.primary} /><Text style={styles.available}>{available} lugares</Text></View>
      </View>
      <View style={styles.driverRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{route.driver?.name?.[0] ?? 'P'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{route.driver?.name ?? 'Motorista Papaleguas'}</Text>
          <Text style={styles.vehicle}>{route.vehicle_model ?? 'Veículo cadastrado'}</Text>
        </View>
        <ArrowRight size={20} color={colors.text} />
      </View>
    </Pressable>
  )
}

function shortAddress(value: string) {
  return value.split(',')[0]
}

function formatDeparture(value: string) {
  const date = new Date(value)
  const today = new Date().toDateString() === date.toDateString() ? 'Hoje' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return `${today} • ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 110, gap: 14 },
  greeting: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: 0 },
  searchPanel: { padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  fieldRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldCopy: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0 },
  input: { height: 36, padding: 0, color: colors.text, fontSize: 16, fontWeight: '700' },
  connector: { height: 1, marginLeft: 30, backgroundColor: colors.line },
  searchButton: { height: 48, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.medium, backgroundColor: colors.primary },
  searchText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  mapSection: { gap: 10 },
  sectionHeader: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  liveLabel: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, overflow: 'hidden', color: colors.primary, backgroundColor: colors.primarySoft, fontSize: 10, fontWeight: '900' },
  resultCount: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  routeCard: { gap: 13, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, backgroundColor: colors.surface, ...shadow },
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  routePath: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeName: { maxWidth: 92, color: colors.text, fontSize: 15, fontWeight: '900' },
  price: { color: colors.primaryDark, fontSize: 16, fontWeight: '900' },
  routeMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  available: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line },
  avatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.blueSoft },
  avatarText: { color: colors.blue, fontWeight: '900' },
  driverName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  vehicle: { color: colors.textMuted, fontSize: 12 },
  empty: { padding: 24, alignItems: 'center', borderRadius: radius.large, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontWeight: '900' },
  emptyText: { marginTop: 5, color: colors.textMuted, textAlign: 'center' },
})
