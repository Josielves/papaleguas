import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CheckCheck, X } from 'lucide-react-native'
import { demoNotifications } from '../data/demo'
import { supabase } from '../lib/supabase'
import { colors, radius, shadow } from '../theme'
import type { AppNotification } from '../types'
import { Brand } from './Brand'

type Props = {
  visible: boolean
  userId: string
  incoming: AppNotification[]
  onClose: () => void
  onOpenRoute: (routeId: string) => void
}

export function NotificationInbox({ visible, userId, incoming, onClose, onOpenRoute }: Props) {
  const [items, setItems] = useState<AppNotification[]>(demoNotifications)

  useEffect(() => {
    if (!visible || !supabase || userId === 'demo-user') return
    supabase
      .from('notifications')
      .select('id,title,message,created_at,read_at,data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => setItems(((data as AppNotification[] | null) ?? []).map((item) => ({
        ...item,
        route_id: item.data && typeof item.data.route_id === 'string' ? item.data.route_id : null,
      }))))
  }, [visible, userId])

  useEffect(() => {
    if (incoming.length === 0) return
    setItems((current) => [
      ...incoming,
      ...current.filter((item) => !incoming.some((next) => next.id === item.id)),
    ])
  }, [incoming])

  const openItem = async (item: AppNotification) => {
    if (!item.read_at && supabase) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', userId)
      setItems((current) => current.map((entry) => (
        entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry
      )))
    }
    if (item.route_id) {
      onClose()
      onOpenRoute(item.route_id)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Brand compact />
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>RECADOS DO PAPALEGUAS</Text>
              <Text style={styles.title}>Notificações</Text>
            </View>
            <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Fechar notificações">
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {items.length === 0 && <Text style={styles.empty}>Nenhuma novidade por enquanto.</Text>}
            {items.map((item) => (
              <Pressable key={item.id} style={[styles.item, !item.read_at && styles.itemUnread]} onPress={() => openItem(item)}>
                <View style={[styles.dot, item.read_at && styles.dotRead]} />
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  <Text style={styles.time}>{new Date(item.created_at).toLocaleString('pt-BR')}</Text>
                </View>
                {item.read_at && <CheckCheck size={17} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' },
  sheet: {
    maxHeight: '78%',
    minHeight: 430,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: colors.background,
    paddingHorizontal: 18,
    paddingBottom: 22,
    ...shadow,
  },
  handle: { width: 42, height: 4, alignSelf: 'center', borderRadius: 2, marginTop: 9, backgroundColor: colors.line },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerCopy: { flex: 1, marginLeft: 9 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0 },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.medium, backgroundColor: colors.surface },
  list: { gap: 9, paddingVertical: 14 },
  item: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  itemUnread: { borderColor: '#A7E8DF', backgroundColor: '#F0FDFA' },
  dot: { width: 9, height: 9, marginTop: 5, borderRadius: 5, backgroundColor: colors.primary },
  dotRead: { backgroundColor: colors.line },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  itemMessage: { color: colors.textMuted, lineHeight: 19, fontSize: 13 },
  time: { color: colors.textMuted, marginTop: 4, fontSize: 11 },
  empty: { color: colors.textMuted, padding: 30, textAlign: 'center' },
})
