import http from 'k6/http'
import { check } from 'k6'

const targetRps = Number(__ENV.TARGET_RPS || 25)
const duration = __ENV.DURATION || '1m'
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || Math.max(25, Math.ceil(targetRps / 4)))
const maxVUs = Number(__ENV.MAX_VUS || Math.max(preAllocatedVUs, Math.ceil(targetRps * 1.5)))
const p95Ms = Number(__ENV.P95_MS || 500)

export const options = {
  discardResponseBodies: true,
  scenarios: {
    route_search: {
      executor: 'constant-arrival-rate',
      rate: targetRps,
      timeUnit: '1s',
      duration,
      preAllocatedVUs,
      maxVUs,
      gracefulStop: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${Math.max(p95Ms * 2, 1000)}`],
    dropped_iterations: ['count==0'],
    checks: ['rate>0.99'],
  },
}

const baseUrl = (__ENV.SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = __ENV.SUPABASE_ANON_KEY
const accessToken = __ENV.TEST_ACCESS_TOKEN

if (!baseUrl || !anonKey || !accessToken) {
  throw new Error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e TEST_ACCESS_TOKEN.')
}

export default function () {
  const result = http.post(
    `${baseUrl}/rest/v1/rpc/search_routes_page`,
    JSON.stringify({
      p_origin_region: null,
      p_destination_region: null,
      p_departure_after: new Date().toISOString(),
      p_cursor_departure: null,
      p_cursor_id: null,
      p_page_size: 20,
    }),
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      tags: { operation: 'search_routes_page' },
    },
  )

  check(result, {
    'status 200': (response) => response.status === 200,
    'retorno JSON': (response) => response.headers['Content-Type']?.includes('application/json'),
  })
}
