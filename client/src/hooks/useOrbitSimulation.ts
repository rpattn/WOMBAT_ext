import { useCallback, useState } from 'react'
import type { LibraryFiles } from '../types'
import { mockApiRequest } from '../workers/mockApiClient'
import { useToasts } from './useToasts'

let workerFallbackWarned_orbit = false
let orbitWorkerSessionId: string | null = null

async function ensureOrbitWorkerSession(): Promise<string> {
  if (orbitWorkerSessionId) return orbitWorkerSessionId
  const wr = await mockApiRequest('POST', '/api/session')
  if (wr.ok && wr.json?.client_id) {
    orbitWorkerSessionId = String(wr.json.client_id)
    return orbitWorkerSessionId
  }
  throw new Error(wr.error || 'Failed to initialize mock worker session')
}

export type UseOrbitSimulationDeps = {
  apiBaseUrl: string
  requireSession: () => string
  setResults: React.Dispatch<React.SetStateAction<any | null>>
  setLibraryFiles: React.Dispatch<React.SetStateAction<LibraryFiles | null>>
  fetchLibraryFiles: () => Promise<void>
}

export function useOrbitSimulation({ apiBaseUrl, requireSession, setResults, setLibraryFiles, fetchLibraryFiles }: UseOrbitSimulationDeps) {
  const { warning } = useToasts()
  type Progress = { now: number, percent?: number | null, message?: string } | null
  const [progress, setProgress] = useState<Progress>(null)

  const runOrbitSimulation = useCallback(async (configPath?: string) => {
    const id = requireSession()
    // Prefer async trigger + poll; fallback to sync
    try {
      const q = configPath ? `?config=${encodeURIComponent(configPath)}` : ''
      const triggerRes = await fetch(`${apiBaseUrl}/${id}/orbit/simulate/trigger${q}`, { method: 'POST' })
      if (triggerRes.ok) {
        const tdata = await triggerRes.json() as { task_id: string, status: string }
        const taskId = tdata.task_id
        let attempts = 0
        const maxAttempts = 600
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        let finalizeGrace = 0
        const finalizeGraceLimit = 15
        while (attempts < maxAttempts) {
          attempts++
          const st = await fetch(`${apiBaseUrl}/orbit/simulate/status/${taskId}`)
          if (!st.ok) throw new Error(await st.text())
          const sdata = await st.json() as { status: string, result?: any, files?: any, progress?: { now: number, percent?: number | null, message?: string } }
          try { console.debug('[orbit][poll]', { attempts, status: sdata.status, progress: sdata.progress }) } catch {}
          if (sdata.progress) setProgress(sdata.progress)
          const isFinalizing = !!sdata.progress && ((sdata.progress.percent ?? 0) >= 100 || sdata.progress.message === 'finalizing')
          if (isFinalizing) finalizeGrace++
          if (sdata.status === 'not_found') {
            setProgress(prev => ({ ...(prev || { now: 0 }), percent: null, message: 'task not found (server reloaded?)' }))
            return
          }
          if (sdata.status !== 'running' && sdata.status !== 'unknown') {
            if (sdata.result) setResults(sdata.result)
            if (sdata.files) setLibraryFiles(sdata.files)
            if (sdata.progress) setProgress({ ...sdata.progress, percent: 100, message: 'finished' })
            else setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
            return
          }
          if (finalizeGrace >= finalizeGraceLimit) {
            await fetchLibraryFiles().catch(() => {})
            setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
            return
          }
          await delay(1000)
        }
        setProgress(prev => ({ ...(prev || { now: 0 }), percent: null, message: 'timeout waiting for completion' }))
        await fetchLibraryFiles().catch(() => {})
        return
      }
    } catch (e) {
      console.warn('Async ORBIT simulation not available or failed, falling back to sync', e)
    }

    // Try worker async ORBIT simulate
    try {
      const wid = await ensureOrbitWorkerSession()
      const t = await mockApiRequest('POST', `/api/${wid}/orbit/simulate/trigger`)
      if (t.ok && t.json?.task_id) {
        if (!workerFallbackWarned_orbit) {
          workerFallbackWarned_orbit = true
          warning('Server unavailable. Using mock Web Worker (ORBIT). Some behavior may be unexpected.')
        }
        const taskId = t.json.task_id as string
        let attempts = 0
        const maxAttempts = 120
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        while (attempts < maxAttempts) {
          attempts++
          const st = await mockApiRequest('GET', `/api/orbit/simulate/status/${taskId}`)
          if (!st.ok) throw new Error(st.error || 'mock ORBIT status error')
          const sdata = st.json as { status: string, result?: any, files?: any, progress?: { now: number, percent?: number | null, message?: string } }
          if (sdata && sdata.progress) setProgress(sdata.progress)
          if (sdata && sdata.status === 'not_found') {
            setProgress(prev => ({ ...(prev || { now: 0 }), percent: null, message: 'task not found (mock)' }))
            return
          }
          if (sdata && sdata.status !== 'running' && sdata.status !== 'unknown') {
            if (sdata.result) setResults(sdata.result)
            if (sdata.files) setLibraryFiles(sdata.files)
            if (sdata.progress) setProgress({ ...sdata.progress, percent: 100, message: 'finished' })
            else setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
            return
          }
          await delay(500)
        }
        setProgress(prev => ({ ...(prev || { now: 0 }), percent: null, message: 'timeout waiting for completion (mock)' }))
        await fetchLibraryFiles().catch(() => {})
        return
      }
    } catch (e) {
      // ignore and try sync worker
    }

    // Fallback to sync worker ORBIT simulate
    const wid = await ensureOrbitWorkerSession()
    const wr = await mockApiRequest('POST', `/api/${wid}/orbit/simulate`)
    if (!wr.ok) throw new Error(wr.error || 'ORBIT simulation failed')
    if (!workerFallbackWarned_orbit) {
      workerFallbackWarned_orbit = true
      warning('Server unavailable. Using mock Web Worker (ORBIT). Some behavior may be unexpected.')
    }
    const data = wr.json as any
    setResults(data.results)
    setLibraryFiles(data.files)
    setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
  }, [apiBaseUrl, requireSession, setResults, setLibraryFiles, fetchLibraryFiles])

  return { runOrbitSimulation, progress }
}
