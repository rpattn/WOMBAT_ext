import { useCallback, useState } from 'react'

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

  const requireSession = useCallback(() => {
    if (!sessionId) throw new Error('No REST session. Initialize first.')
    return sessionId
  }, [sessionId])

  const initSession = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/session`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSessionId(data.client_id)
      return data.client_id as string
    } catch (e) {
      console.error('initSession error', e)
      setSessionId(null)
      return null
    }
  }, [apiBaseUrl])

  const endSession = useCallback(async () => {
    try {
      const id = requireSession()
      await fetch(`${apiBaseUrl}/session/${id}`, { method: 'DELETE' })
    } catch (e) {
      console.warn('endSession error', e)
    } finally {
      setSessionId(null)
    }
  }, [apiBaseUrl, requireSession])

  return { apiBaseUrl, setApiBaseUrl, sessionId, initSession, endSession, requireSession }
}
