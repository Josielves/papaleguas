import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type NotificationRecord = {
  id: string
  user_id: string
  title: string
  message: string
  data?: Record<string, unknown>
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!expectedSecret) {
    return Response.json({ error: 'PUSH_WEBHOOK_SECRET is not configured' }, { status: 503 })
  }
  if (request.headers.get('x-papaleguas-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  const record = (payload.record ?? payload) as NotificationRecord
  if (!record?.user_id || !record.title || !record.message) {
    return Response.json({ error: 'Invalid notification payload' }, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: devices, error } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', record.user_id)
    .gte('last_seen_at', new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!devices?.length) return Response.json({ sent: 0 })

  const messages = devices.slice(0, 100).map((device) => ({
    to: device.expo_push_token,
    sound: 'default',
    channelId: 'viagens',
    title: record.title,
    body: record.message,
    data: {
      ...record.data,
      notificationId: record.id,
      routeId: record.data?.route_id,
    },
    priority: 'high',
  }))

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN')
        ? { 'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
        : {}),
    },
    body: JSON.stringify(messages),
  })

  const result = await expoResponse.json()
  return Response.json({ sent: messages.length, expo: result }, { status: expoResponse.status })
})
