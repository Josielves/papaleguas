import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  scenarios: {
    route_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
}

const baseUrl = __ENV.SUPABASE_URL
const anonKey = __ENV.SUPABASE_ANON_KEY
const accessToken = __ENV.TEST_ACCESS_TOKEN

if (!baseUrl || !anonKey || !accessToken) {
  throw new Error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e TEST_ACCESS_TOKEN.')
}

export default function () {
  const departure = encodeURIComponent(new Date().toISOString())
  const url = `${baseUrl}/rest/v1/routes?select=id,origin_region,destination_region,departure_time,available_seats,status&status=in.(open,full)&departure_time=gte.${departure}&order=departure_time.asc&limit=50`
  const result = http.get(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    tags: { operation: 'search_routes' },
  })

  check(result, {
    'status 200': (response) => response.status === 200,
    'retorno e JSON': (response) => response.headers['Content-Type']?.includes('application/json'),
  })
  sleep(1)
}
