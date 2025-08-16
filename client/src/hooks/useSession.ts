import { useCallback, useState } from 'react'
import { mockApiRequest } from '../workers/mockApiClient'
import { useToasts } from './useToasts'

let workerFallbackWarned_session = false

export type UseSessionReturn = {
  apiBaseUrl: string
  setApiBaseUrl: (v: string) => void
  sessionId: string | null
  initSession: () => Promise<string | null>
  endSession: () => Promise<void>
  requireSession: () => string
}

export function useSession(initialApiBase?: string): UseSessionReturn {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(initialApiBase ?? ((import.meta as any).env?.VITE_API_URL ?? 'http://127.0.0.1:8000/api'))
  const [sessionId, setSessionId] = useState<string | null>(null)
  const { warning } = useToasts()

  const requireSession = useCallback(() => {
    if (!sessionId) throw new Error('No REST session. Initialize first.')
    return sessionId
  }, [sessionId])

  const initSession = useCallback(async () => {
    // Try real server first
    try {
      const res = await fetch(`${apiBaseUrl}/session`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSessionId(data.client_id)
        return data.client_id as string
      }
      // Non-OK -> fall through to mock
      throw new Error(await res.text())
    } catch (e) {
      // Fallback to mock worker
      try {
        const wr = await mockApiRequest('POST', '/api/session')
        if (wr.ok && wr.json?.client_id) {
          const cid = String(wr.json.client_id)
          setSessionId(cid)
          if (!workerFallbackWarned_session) {
            workerFallbackWarned_session = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
          return cid
        }
      } catch (e2) {
        console.error('mock initSession error', e2)
      }
      setSessionId(null)
      return null
    }
  }, [apiBaseUrl])

  const endSession = useCallback(async () => {
    const id = sessionId ?? undefined
    try {
      if (!id) throw new Error('No REST session')
      const res = await fetch(`${apiBaseUrl}/session/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      // Attempt worker fallback
      if (id) {
        try {
          await mockApiRequest('DELETE', `/api/session/${id}`)
          if (!workerFallbackWarned_session) {
            workerFallbackWarned_session = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
        } catch (e2) {
          // ignore
        }
      }
    } finally {
      setSessionId(null)
    }
  }, [apiBaseUrl, sessionId])

  return { apiBaseUrl, setApiBaseUrl, sessionId, initSession, endSession, requireSession }
}
