// Transparent fetch wrapper that falls back to the mock API Web Worker when HTTP fails.
// This keeps the frontend unaware of whether a real server is present.

import { mockApiRequest } from './mockApiClient'

// Only paths under this prefix are considered API calls eligible for worker fallback
function isApiUrl(url: URL, apiBaseUrl: string): boolean {
  try {
    const base = new URL(apiBaseUrl)
    return url.origin === base.origin && url.pathname.startsWith(base.pathname)
  } catch {
    // If apiBaseUrl is relative like "/api", match pathname prefix
    return url.pathname.startsWith(apiBaseUrl)
  }
}

// Convert a URL like `${apiBaseUrl}/...` into worker path beginning with /api/...
function toWorkerPath(url: URL, apiBaseUrl: string): string {
  // Ensure the resulting path always starts with /api
  // Find the substring of the pathname after apiBaseUrl's pathname
  let basePathname = ''
  try {
    basePathname = new URL(apiBaseUrl).pathname.replace(/\/$/, '')
  } catch {
    basePathname = String(apiBaseUrl).replace(/\/$/, '')
  }
  const suffix = url.pathname.replace(new RegExp(`^${basePathname}`), '') || '/'
  const path = suffix.startsWith('/api') ? suffix : `/api${suffix}`
  const qs = url.search || ''
  return `${path}${qs}`
}

// Minimal Response-like wrapper for worker replies
function makeResponseFromWorker(wr: any): Response {
  const status = typeof wr.status === 'number' ? wr.status : (wr.ok ? 200 : 500)
  const headers = new Headers({ 'content-type': 'application/json', 'x-worker-fallback': 'true' })
  const bodyObj = wr.json ?? (wr.error ? { error: String(wr.error) } : {})
  const bodyStr = JSON.stringify(bodyObj)
  return new Response(bodyStr, { status, headers })
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit, apiBaseUrl = '/api'): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : (input as URL | Request).toString(), window.location.href)
  const method = (init?.method || 'GET').toUpperCase()
  const nativeFetch: typeof fetch = ((window as any).__originalFetch as any) || window.fetch.bind(window)

  // Try network first for API URLs; if fails, fall back to worker
  if (isApiUrl(url, apiBaseUrl)) {
    try {
      const res = await nativeFetch(url.toString(), init)
      if (res.ok) return res
      // Only fall back for certain server statuses that indicate the route isn't available
      const fallbackStatuses = new Set([404, 501, 502, 503, 504])
      if (!fallbackStatuses.has(res.status)) {
        return res
      }
      // Try worker fallback
      try {
        let body: any = undefined
        // Best effort: support JSON payloads only (sufficient for our API)
        if (init?.body) {
          if (typeof init.body === 'string') {
            try { body = JSON.parse(init.body) } catch { body = init.body }
          } else if (init.body instanceof Blob) {
            body = await init.body.text().then(t => { try { return JSON.parse(t) } catch { return t } })
          } else {
            body = init.body as any
          }
        }
        let workerPath = toWorkerPath(url, apiBaseUrl)

        // Do NOT remap non client-scoped status endpoints
        const isStatusEndpoint = /^\/api\/(?:orbit\/)?simulate\/status\//.test(workerPath)

        // If the path is client-scoped (/api/{cid}/...), map real server session IDs to a worker session ID
        // Cache mapping so subsequent requests use the same worker session
        if (!isStatusEndpoint) {
          const m = workerPath.match(/^\/(?:api)\/([^/]+)(\/.*)$/)
          if (m && m[1] && m[2]) {
            const originalCid = m[1]
            // Maintain a per-page map from originalCid -> workerCid
            const g = (window as any)
            g.__workerCidMap = g.__workerCidMap || new Map<string, string>()
            let workerCid = g.__workerCidMap.get(originalCid)
            if (!workerCid) {
              const sessionRes = await mockApiRequest('POST', '/api/session')
              if (sessionRes.ok && sessionRes.json?.client_id) {
                workerCid = String(sessionRes.json.client_id)
                g.__workerCidMap.set(originalCid, workerCid)
              }
            }
            if (workerCid) {
              workerPath = `/api/${encodeURIComponent(workerCid)}${m[2]}`
            }
          }
        }

        const wr = await mockApiRequest(method, workerPath, body)
        return makeResponseFromWorker(wr)
      } catch {
        return res
      }
    } catch {
      // network failed -> attempt worker
      try {
        let body: any = undefined
        if (init?.body) {
          if (typeof init.body === 'string') {
            try { body = JSON.parse(init.body) } catch { body = init.body }
          } else if (init.body instanceof Blob) {
            body = await init.body.text().then(t => { try { return JSON.parse(t) } catch { return t } })
          } else {
            body = init.body as any
          }
        }
        let workerPath = toWorkerPath(url, apiBaseUrl)
        const isStatusEndpoint = /^\/api\/(?:orbit\/)?simulate\/status\//.test(workerPath)
        if (!isStatusEndpoint) {
          const m = workerPath.match(/^\/(?:api)\/([^/]+)(\/.*)$/)
          if (m && m[1] && m[2]) {
            const originalCid = m[1]
            const g = (window as any)
            g.__workerCidMap = g.__workerCidMap || new Map<string, string>()
            let workerCid = g.__workerCidMap.get(originalCid)
            if (!workerCid) {
              const sessionRes = await mockApiRequest('POST', '/api/session')
              if (sessionRes.ok && sessionRes.json?.client_id) {
                workerCid = String(sessionRes.json.client_id)
                g.__workerCidMap.set(originalCid, workerCid)
              }
            }
            if (workerCid) {
              workerPath = `/api/${encodeURIComponent(workerCid)}${m[2]}`
            }
          }
        }
        const wr = await mockApiRequest(method, workerPath, body)
        return makeResponseFromWorker(wr)
      } catch (e) {
        // If worker also fails, propagate original network-style error
        throw e
      }
    }
  }

  // Non-API URL: normal fetch
  return nativeFetch(url.toString(), init)
}

// Optional: enable global fetch override. Use with caution in tests.
export function enableWorkerFetchGlobally(apiBaseUrl = '/api') {
  const originalFetch = window.fetch.bind(window)
  ;(window as any).__originalFetch = originalFetch
  window.fetch = (input: any, init?: RequestInit) => apiFetch(
    typeof input === 'string' || input instanceof URL ? input : (input?.url || String(input)),
    init,
    apiBaseUrl,
  )
}
