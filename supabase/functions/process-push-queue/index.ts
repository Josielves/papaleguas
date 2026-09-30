import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type OutboxJob = {
  outbox_id: number
  notification_id: string
  user_id: string
  title: string
  message: string
  data: Record<string, unknown>
  attempts: number
}

type PushTicket = {
  status?: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

type Delivery = {
  job: OutboxJob
  token: string
  message: Record<string, unknown>
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const PERMANENT_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig'])

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function retryAfterSeconds(response: Response) {
  const value = Number(response.headers.get('retry-after'))
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!expectedSecret) return json({ error: 'PUSH_WEBHOOK_SECRET is not configured' }, 503)
  if (request.headers.get('x-papaleguas-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service credentials are not configured' }, 503)
  }

  let requestedBatch = 50
  try {
    const body = await request.json()
    requestedBatch = Number(body?.batch_size ?? requestedBatch)
  } catch {
    // An empty body is valid for scheduled invocations.
  }
  const batchSize = Math.min(Math.max(Number.isFinite(requestedBatch) ? requestedBatch : 50, 1), 50)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error: claimError } = await admin.rpc('claim_notification_outbox', {
    p_batch_size: batchSize,
  })
  if (claimError) return json({ error: claimError.message }, 500)

  const jobs = (data ?? []) as OutboxJob[]
  if (jobs.length === 0) return json({ claimed: 0, delivered: 0, retried: 0 })

  const userIds = [...new Set(jobs.map((job) => job.user_id))]
  const activeSince = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
  const { data: devices, error: devicesError } = await admin
    .from('push_tokens')
    .select('user_id,expo_push_token')
    .in('user_id', userIds)
    .gte('last_seen_at', activeSince)

  const complete = async (
    job: OutboxJob,
    success: boolean,
    error: string | null,
    providerResponse: unknown,
    retrySeconds: number | null = null,
  ) => admin.rpc('complete_notification_outbox', {
    p_outbox_id: job.outbox_id,
    p_success: success,
    p_error: error,
    p_provider_response: providerResponse,
    p_retry_after_seconds: retrySeconds,
  })

  if (devicesError) {
    await Promise.all(jobs.map((job) => complete(job, false, devicesError.message, null)))
    return json({ error: devicesError.message, claimed: jobs.length }, 500)
  }

  const tokensByUser = new Map<string, string[]>()
  for (const device of devices ?? []) {
    const tokens = tokensByUser.get(device.user_id) ?? []
    if (tokens.length < 2) tokens.push(device.expo_push_token)
    tokensByUser.set(device.user_id, tokens)
  }

  const deliveries: Delivery[] = []
  const noDeviceJobs: OutboxJob[] = []
  for (const job of jobs) {
    const tokens = tokensByUser.get(job.user_id) ?? []
    if (tokens.length === 0) {
      noDeviceJobs.push(job)
      continue
    }

    for (const token of tokens) {
      deliveries.push({
        job,
        token,
        message: {
          to: token,
          sound: 'default',
          channelId: 'viagens',
          title: job.title,
          body: job.message,
          data: {
            ...job.data,
            notificationId: job.notification_id,
            routeId: job.data?.route_id,
          },
          priority: 'high',
        },
      })
    }
  }

  await Promise.all(noDeviceJobs.map((job) => complete(
    job,
    true,
    null,
    { skipped: 'no_active_device' },
  )))

  const results = new Map<number, { ok: boolean; transient: boolean; errors: string[]; tickets: PushTicket[] }>()
  const invalidTokens = new Set<string>()
  let providerFailure: { message: string; retryAfter: number | null } | null = null

  for (const deliveryChunk of chunks(deliveries, 100)) {
    let response: Response
    try {
      response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(Deno.env.get('EXPO_ACCESS_TOKEN')
            ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
            : {}),
        },
        body: JSON.stringify(deliveryChunk.map((item) => item.message)),
      })
    } catch (error) {
      providerFailure = { message: error instanceof Error ? error.message : 'Expo request failed', retryAfter: null }
      break
    }

    if (!response.ok) {
      providerFailure = {
        message: `Expo returned HTTP ${response.status}`,
        retryAfter: retryAfterSeconds(response),
      }
      break
    }

    let payload: { data?: PushTicket[] }
    try {
      payload = await response.json() as { data?: PushTicket[] }
    } catch {
      providerFailure = { message: 'Expo returned an invalid JSON response', retryAfter: null }
      break
    }
    const tickets = Array.isArray(payload.data) ? payload.data : []
    deliveryChunk.forEach((delivery, index) => {
      const ticket = tickets[index] ?? { status: 'error', message: 'Missing Expo ticket' }
      const current = results.get(delivery.job.outbox_id) ?? {
        ok: false,
        transient: false,
        errors: [],
        tickets: [],
      }
      current.tickets.push(ticket)
      if (ticket.status === 'ok') {
        current.ok = true
      } else {
        const code = ticket.details?.error ?? 'UnknownExpoError'
        current.errors.push(`${code}: ${ticket.message ?? 'push rejected'}`)
        if (!PERMANENT_ERRORS.has(code)) current.transient = true
        if (code === 'DeviceNotRegistered') invalidTokens.add(delivery.token)
      }
      results.set(delivery.job.outbox_id, current)
    })
  }

  if (invalidTokens.size > 0) {
    await admin.from('push_tokens').delete().in('expo_push_token', [...invalidTokens])
  }

  let delivered = noDeviceJobs.length
  let retried = 0
  let deadOrPermanent = 0
  await Promise.all(jobs
    .filter((job) => !noDeviceJobs.some((item) => item.outbox_id === job.outbox_id))
    .map(async (job) => {
      const result = results.get(job.outbox_id)
      if (result?.ok) {
        delivered += 1
        await complete(job, true, null, { tickets: result.tickets })
      } else if (providerFailure) {
        retried += 1
        await complete(job, false, providerFailure.message, { tickets: result?.tickets }, providerFailure.retryAfter)
      } else if (result?.transient || !result) {
        retried += 1
        await complete(job, false, result?.errors.join('; ') ?? 'No Expo result', { tickets: result?.tickets })
      } else {
        deadOrPermanent += 1
        await complete(job, true, result.errors.join('; '), { permanent_failure: true, tickets: result.tickets })
      }
    }))

  return json({
    claimed: jobs.length,
    messages: deliveries.length,
    delivered,
    retried,
    permanent_failures: deadOrPermanent,
    invalid_tokens_removed: invalidTokens.size,
  }, providerFailure ? 503 : 200)
})
