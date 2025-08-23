import { useCallback, useState } from 'react'
import type { LibraryFiles } from '../types'
import { mockApiRequest } from '../workers/mockApiClient'
import { useToasts } from './useToasts'

let workerFallbackWarned_sim = false
let workerSessionId: string | null = null

async function ensureWorkerSession(): Promise<string> {
  if (workerSessionId) return workerSessionId
  const wr = await mockApiRequest('POST', '/api/session')
  if (wr.ok && wr.json?.client_id) {
    workerSessionId = String(wr.json.client_id)
    return workerSessionId
  }
  throw new Error(wr.error || 'Failed to initialize mock worker session')
}

export type UseSimulationDeps = {
  apiBaseUrl: string
  requireSession: () => string
  setResults: React.Dispatch<React.SetStateAction<any | null>>
  setLibraryFiles: React.Dispatch<React.SetStateAction<LibraryFiles | null>>
  fetchLibraryFiles: () => Promise<void>
}

export function useSimulation({ apiBaseUrl, requireSession, setResults, setLibraryFiles, fetchLibraryFiles }: UseSimulationDeps) {
  const { warning } = useToasts()
  type Progress = { now: number, percent?: number | null, message?: string } | null
  const [progress, setProgress] = useState<Progress>(null)
  const runSimulation = useCallback(async () => {
    const id = requireSession()
    // Prefer async trigger + poll; fallback to sync
    try {
      const triggerRes = await fetch(`${apiBaseUrl}/${id}/simulate/trigger`, { method: 'POST' })
      if (triggerRes.ok) {
        const tdata = await triggerRes.json() as { task_id: string, status: string }
        const taskId = tdata.task_id
        let attempts = 0
        const maxAttempts = 600
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        // If server reports progress.percent>=100 or message==='finalizing', allow a short
        // grace window to flip status, then conclude to avoid appearing stuck at 100%.
        let finalizeGrace = 0
        const finalizeGraceLimit = 15 // ~15s
        while (attempts < maxAttempts) {
          attempts++
          const st = await fetch(`${apiBaseUrl}/simulate/status/${taskId}`)
          if (!st.ok) throw new Error(await st.text())
          const sdata = await st.json() as { status: string, result?: any, files?: any, progress?: { now: number, percent?: number | null, message?: string } }
          // Debug trace for investigation
          try { console.debug('[simulate][poll]', { attempts, status: sdata.status, progress: sdata.progress }) } catch {}
          if (sdata.progress) setProgress(sdata.progress)
          const isFinalizing = !!sdata.progress && ((sdata.progress.percent ?? 0) >= 100 || sdata.progress.message === 'finalizing')
          if (isFinalizing) finalizeGrace++
          if (sdata.status === 'not_found') {
            // Likely server reload cleared in-memory tasks; surface as terminal
            setProgress(prev => ({ ...(prev || { now: 0 }), percent: null, message: 'task not found (server reloaded?)' }))
            return
          }
          if (sdata.status !== 'running' && sdata.status !== 'unknown') {
            if (sdata.result) setResults(sdata.result)
            if (sdata.files) setLibraryFiles(sdata.files)
            // finalize progress
            if (sdata.progress) setProgress({ ...sdata.progress, percent: 100, message: 'finished' })
            else setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
            return
          }
          // If we've been at 100%/finalizing for a while, stop waiting and fetch latest files
          if (finalizeGrace >= finalizeGraceLimit) {
            await fetchLibraryFiles().catch(() => {})
            setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
            return
          }
          await delay(1000)
        }
        // Timed out waiting for task to finish
        setProgress(prev => ({ ...(prev || { now: 0 }), percent: null, message: 'timeout waiting for completion' }))
        await fetchLibraryFiles().catch(() => {})
        return
      }
    } catch (e) {
      console.warn('Async simulation not available or failed, falling back to sync', e)
    }

    // Try worker async simulate
    try {
      const wid = await ensureWorkerSession()
      const t = await mockApiRequest('POST', `/api/${wid}/simulate/trigger`)
      if (t.ok && t.json?.task_id) {
        if (!workerFallbackWarned_sim) {
          workerFallbackWarned_sim = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
        const taskId = t.json.task_id as string
        let attempts = 0
        const maxAttempts = 120
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        while (attempts < maxAttempts) {
          attempts++
          const st = await mockApiRequest('GET', `/api/simulate/status/${taskId}`)
          if (!st.ok) throw new Error(st.error || 'mock status error')
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

    // Fallback to sync worker simulate
    const wid = await ensureWorkerSession()
    const wr = await mockApiRequest('POST', `/api/${wid}/simulate`)
    if (!wr.ok) throw new Error(wr.error || 'Simulation failed')
    if (!workerFallbackWarned_sim) {
      workerFallbackWarned_sim = true
      warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
    }
    const data = wr.json as any
    setResults(data.results)
    setLibraryFiles(data.files)
    setProgress(prev => prev ? { ...prev, percent: 100, message: 'finished' } : { now: 0, percent: 100, message: 'finished' })
  }, [apiBaseUrl, requireSession, setResults, setLibraryFiles, fetchLibraryFiles])

  return { runSimulation, progress }
}
