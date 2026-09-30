import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque'
import type { Session } from '@supabase/supabase-js'
import { Bell, CalendarCheck, ChevronRight, Home, MessageCircle, Route as RouteIcon, UserRound } from 'lucide-react-native'
import { Brand } from './src/components/Brand'
import { NotificationInbox } from './src/components/NotificationInbox'
import { demoProfile, demoRoutes } from './src/data/demo'
import { isSupabaseConfigured, supabase } from './src/lib/supabase'
import { listenForNotificationOpen, registerDeviceForNotifications, subscribeToNativeNotifications } from './src/services/notifications'
import { AuthScreen } from './src/screens/AuthScreen'
import { DriverDashboard } from './src/screens/DriverDashboard'
import { PassengerHome } from './src/screens/PassengerHome'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { RouteDetails } from './src/screens/RouteDetails'
import { colors, fonts, shadow } from './src/theme'
import type { AppNotification, AppRole, Profile, Route } from './src/types'

type Tab = 'home' | 'routes' | 'messages' | 'profile'

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  })
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [profile, setProfile] = useState<Profile>(demoProfile)
  const [role, setRole] = useState<AppRole>('passenger')
  const [routes, setRoutes] = useState<Route[]>(isSupabaseConfigured ? [] : demoRoutes)
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routesLoadingMore, setRoutesLoadingMore] = useState(false)
  const routesCursor = useRef<{ departureTime: string; id: string } | null>(null)
  const [hasMoreRoutes, setHasMoreRoutes] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [incoming, setIncoming] = useState<AppNotification[]>([])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) return
    supabase
      .from('profiles')
      .select('id,name,phone,avatar_url,account_type,vehicle_brand,vehicle_model,vehicle_plate,vehicle_color,vehicle_year,vehicle_model_year,vehicle_type,vehicle_capacity,vehicle_lookup_verified_at')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        const next = { ...data, email: session.user.email } as Profile
        setProfile(next)
        setRole(next.account_type === 'driver' ? 'driver' : 'passenger')
      })
  }, [session?.user.id])

  const loadRoutes = useCallback(async ({ append = false }: { append?: boolean } = {}) => {
    if (!supabase || !session?.user) {
      setRoutes(demoRoutes)
      return
    }
    append ? setRoutesLoadingMore(true) : setRoutesLoading(true)
    const { data, error } = role === 'driver'
      ? await supabase
          .from('routes')
          .select('*,driver:profiles!routes_driver_id_fkey(id,name,phone,avatar_url),seats(*),bookings(id,status,amount)')
          .eq('driver_id', session.user.id)
          .order('departure_time', { ascending: true })
          .limit(100)
      : await supabase.rpc('search_routes_page', {
          p_origin_region: null,
          p_destination_region: null,
          p_departure_after: new Date().toISOString(),
          p_cursor_departure: append ? routesCursor.current?.departureTime ?? null : null,
          p_cursor_id: append ? routesCursor.current?.id ?? null : null,
          p_page_size: 50,
        })
    if (!error) {
      const page = (data as unknown as Route[]) ?? []
      setRoutes((current) => append && role === 'passenger' ? [...current, ...page] : page)
      if (role === 'passenger') {
        const last = page.at(-1)
        routesCursor.current = last ? { departureTime: last.departure_time, id: last.id } : null
        setHasMoreRoutes(page.length === 50)
      } else {
        routesCursor.current = null
        setHasMoreRoutes(false)
      }
    }
    setRoutesLoading(false)
    setRoutesLoadingMore(false)
  }, [role, session?.user.id])

  useEffect(() => {
    void loadRoutes()
  }, [loadRoutes])

  const openRouteById = useCallback(async (routeId: string) => {
    const route = routes.find((item) => item.id === routeId)
    if (route) {
      setSelectedRoute(route)
      setTab('home')
      return
    }

    if (!supabase || !session?.user) return
    const { data } = await supabase
      .from('routes')
      .select('*,driver:profiles!routes_driver_id_fkey(id,name,phone,avatar_url),seats(*)')
      .eq('id', routeId)
      .maybeSingle()
    if (data) {
      setSelectedRoute(data as unknown as Route)
      setTab('home')
    }
  }, [routes, session?.user.id])

  useEffect(() => {
    const userId = session?.user.id ?? (!isSupabaseConfigured ? profile.id : null)
    if (!userId) return
    void registerDeviceForNotifications(userId).catch(() => undefined)
    const channel = subscribeToNativeNotifications(userId, (notification) => {
      setIncoming((current) => [notification, ...current.filter((item) => item.id !== notification.id)])
    })
    const response = listenForNotificationOpen(openRouteById)
    return () => {
      response.remove()
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [session?.user.id, profile.id, openRouteById])

  const userId = session?.user.id ?? profile.id
  const unread = incoming.filter((item) => !item.read_at).length + (isSupabaseConfigured ? 0 : 2)
  const tabs = useMemo(() => role === 'driver'
    ? [
        { id: 'home' as const, label: 'Painel', icon: Home },
        { id: 'routes' as const, label: 'Rotas', icon: RouteIcon },
        { id: 'messages' as const, label: 'Mensagens', icon: MessageCircle },
        { id: 'profile' as const, label: 'Perfil', icon: UserRound },
      ]
    : [
        { id: 'home' as const, label: 'Início', icon: Home },
        { id: 'routes' as const, label: 'Reservas', icon: CalendarCheck },
        { id: 'messages' as const, label: 'Mensagens', icon: MessageCircle },
        { id: 'profile' as const, label: 'Perfil', icon: UserRound },
      ], [role])

  if (authLoading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Image source={require('./assets/splash-icon.png')} style={styles.loadingBird} resizeMode="contain" />
        <Text style={styles.loadingBrand}>Papa-léguas</Text>
        <ActivityIndicator size="small" color={colors.text} />
        <Text style={styles.loadingText}>Preparando suas rotas...</Text>
      </View>
    )
  }
  if (isSupabaseConfigured && !session) return <AuthScreen />

  const content = selectedRoute
    ? <RouteDetails route={selectedRoute} profile={profile} onBack={() => setSelectedRoute(null)} />
    : tab === 'profile'
      ? <ProfileScreen profile={profile} role={role} onRoleChange={(next) => { setRole(next); setTab('home') }} onProfileChange={setProfile} />
      : tab === 'routes'
        ? <ActivityView role={role} routes={routes} onSelectRoute={setSelectedRoute} />
        : tab === 'messages'
          ? <MessagesView />
          : role === 'driver'
            ? <DriverDashboard profile={profile} routes={routes} loading={routesLoading} onRefresh={loadRoutes} />
            : <PassengerHome
                profile={profile}
                routes={routes}
                loading={routesLoading}
                loadingMore={routesLoadingMore}
                hasMore={hasMoreRoutes}
                onRefresh={() => void loadRoutes()}
                onLoadMore={() => void loadRoutes({ append: true })}
                onSelectRoute={setSelectedRoute}
              />

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {!selectedRoute && (
        <View style={styles.header}>
          <Brand />
          <Pressable style={styles.bell} onPress={() => setInboxOpen(true)} accessibilityLabel={`${unread} notificações não lidas`}>
            <Bell size={20} color={colors.text} />
            {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
          </Pressable>
        </View>
      )}
      <View style={styles.main}>{content}</View>
      {!selectedRoute && (
        <View style={styles.bottomNav}>
          {tabs.map((item) => {
            const active = tab === item.id
            const Icon = item.icon
            return (
              <Pressable key={item.id} style={[styles.navItem, active && styles.navItemActive]} onPress={() => setTab(item.id)}>
                {active && <View style={styles.navIndicator} />}
                <Icon size={21} color={active ? colors.text : colors.textMuted} strokeWidth={active ? 2.7 : 2} />
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>
      )}
      <NotificationInbox visible={inboxOpen} userId={userId} incoming={incoming} onClose={() => setInboxOpen(false)} onOpenRoute={openRouteById} />
    </SafeAreaView>
  )
}

function ActivityView({ role, routes, onSelectRoute }: { role: AppRole; routes: Route[]; onSelectRoute: (route: Route) => void }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderEyebrow}>{role === 'driver' ? 'PLANEJAMENTO' : 'SUA AGENDA'}</Text>
      <Text style={styles.placeholderTitle}>{role === 'driver' ? 'Suas rotas' : 'Suas reservas'}</Text>
      <Text style={styles.placeholderText}>{role === 'driver' ? 'Acompanhe as próximas saídas e abra a operação no mapa.' : 'Consulte seus próximos embarques e acompanhe o motorista.'}</Text>
      {routes.slice(0, 4).map((route) => (
        <Pressable key={route.id} style={styles.placeholderCard} onPress={() => onSelectRoute(route)}>
          <View style={styles.cardIcon}><RouteIcon size={18} color={colors.text} /></View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{route.origin_address.split(',')[0]} → {route.destination_address.split(',')[0]}</Text><Text style={styles.cardText}>{new Date(route.departure_time).toLocaleString('pt-BR')}</Text></View>
          <ChevronRight size={19} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  )
}

function MessagesView() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderEyebrow}>CONVERSAS</Text>
      <Text style={styles.placeholderTitle}>Mensagens</Text>
      <Text style={styles.placeholderText}>As conversas vinculadas às suas viagens aparecerão aqui.</Text>
      <View style={styles.messageEmpty}>
        <View style={styles.messageIcon}><MessageCircle size={25} color={colors.text} /></View>
        <Text style={styles.messageTitle}>Tudo tranquilo por aqui</Text>
        <Text style={styles.cardText}>Nenhuma mensagem pendente.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.primary },
  loadingBird: { width: 132, height: 96 },
  loadingBrand: { color: colors.text, fontSize: 24, fontFamily: fonts.extraBold },
  loadingText: { color: colors.text, fontSize: 12, fontFamily: fonts.bold },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  bell: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  badge: { position: 'absolute', top: -1, right: -1, minWidth: 17, height: 17, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.primary },
  badgeText: { color: colors.text, fontSize: 9, fontFamily: fonts.extraBold },
  main: { flex: 1, backgroundColor: colors.background },
  bottomNav: { height: 70, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, ...shadow },
  navItem: { flex: 1, height: 68, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navItemActive: { backgroundColor: colors.surface },
  navIndicator: { position: 'absolute', top: 0, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.primary },
  navText: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold },
  navTextActive: { color: colors.text, fontFamily: fonts.extraBold },
  placeholder: { flex: 1, padding: 20, gap: 12, backgroundColor: colors.background },
  placeholderEyebrow: { color: colors.primaryDark, fontSize: 10, fontFamily: fonts.extraBold },
  placeholderTitle: { color: colors.text, fontSize: 27, fontFamily: fonts.extraBold },
  placeholderText: { color: colors.textMuted, lineHeight: 20, fontFamily: fonts.regular },
  placeholderCard: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  cardIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.primary },
  cardTitle: { color: colors.text, fontFamily: fonts.extraBold },
  cardText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  messageEmpty: { alignItems: 'center', gap: 7, paddingVertical: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.surface },
  messageIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.primary },
  messageTitle: { marginTop: 4, color: colors.text, fontSize: 16, fontFamily: fonts.extraBold },
})
