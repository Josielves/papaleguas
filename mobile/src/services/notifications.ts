import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AppNotification } from '../types'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerDeviceForNotifications(userId: string) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('viagens', {
      name: 'Viagens e reservas',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 90, 180],
      lightColor: '#0F9F93',
      sound: 'default',
    })
  }

  const current = await Notifications.getPermissionsAsync()
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync()

  if (permission.status !== 'granted' || !Device.isDevice) return null

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
  if (!projectId) return null

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  if (!supabase) return token

  const { error } = await supabase.from('push_tokens').upsert({
    user_id: userId,
    expo_push_token: token,
    platform: Platform.OS,
    device_name: Device.deviceName,
    app_version: Constants.expoConfig?.version,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,expo_push_token' })

  if (error) console.warn('Falha ao registrar push token:', error.message)
  return token
}

export function subscribeToNativeNotifications(
  userId: string,
  onNotification: (notification: AppNotification) => void,
): RealtimeChannel | null {
  if (!supabase) return null

  const delivered = new Set<string>()
  const deliver = async (raw: Record<string, unknown>) => {
    const received = (raw.new ?? raw.record ?? raw) as AppNotification
    const routeId = received.route_id
      ?? (received.data && typeof received.data.route_id === 'string' ? received.data.route_id : null)
    const notification = { ...received, route_id: routeId }
    if (!notification?.id || delivered.has(notification.id)) return
    delivered.add(notification.id)
    onNotification(notification)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: notification.id,
          routeId: notification.route_id,
        },
        sound: 'default',
      },
      trigger: null,
    })
  }

  return supabase
    .channel(`user:${userId}:notifications`, { config: { private: true } })
    .on('broadcast', { event: 'INSERT' }, (payload) => void deliver(payload.payload))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => void deliver(payload as unknown as Record<string, unknown>),
    )
    .subscribe()
}

export function listenForNotificationOpen(onOpenRoute: (routeId: string) => void) {
  const openRoute = (response: Notifications.NotificationResponse) => {
    const routeId = response.notification.request.content.data?.routeId
    if (typeof routeId === 'string') onOpenRoute(routeId)
  }

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return
    openRoute(response)
    void Notifications.clearLastNotificationResponseAsync()
  })

  return Notifications.addNotificationResponseReceivedListener(openRoute)
}
