import { useCallback } from 'react'

export type UseTempDeps = {
  apiBaseUrl: string
  requireSession: () => string
}

export function useTemp({ apiBaseUrl, requireSession }: UseTempDeps) {
  const clearClientTemp = useCallback(async () => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/temp`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return Boolean(data?.ok)
  }, [apiBaseUrl, requireSession])

  const sweepTemp = useCallback(async () => {
    const res = await fetch(`${apiBaseUrl}/temp/sweep`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    const removed = Array.isArray(data?.removed) ? data.removed : []
    return removed.length as number
  }, [apiBaseUrl])

  const sweepTempAll = useCallback(async () => {
    const res = await fetch(`${apiBaseUrl}/temp/sweep_all`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    const removed = Array.isArray(data?.removed) ? data.removed : []
    return removed.length as number
  }, [apiBaseUrl])

  return { clearClientTemp, sweepTemp, sweepTempAll }
}
