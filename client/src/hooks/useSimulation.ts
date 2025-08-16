import { useCallback } from 'react'
import type { LibraryFiles } from '../types'

export type UseSimulationDeps = {
  apiBaseUrl: string
  requireSession: () => string
  setResults: React.Dispatch<React.SetStateAction<any | null>>
  setLibraryFiles: React.Dispatch<React.SetStateAction<LibraryFiles | null>>
  fetchLibraryFiles: () => Promise<void>
}

export function useSimulation({ apiBaseUrl, requireSession, setResults, setLibraryFiles, fetchLibraryFiles }: UseSimulationDeps) {
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
        while (attempts < maxAttempts) {
          attempts++
          const st = await fetch(`${apiBaseUrl}/simulate/status/${taskId}`)
          if (!st.ok) throw new Error(await st.text())
          const sdata = await st.json() as { status: string, result?: any, files?: any }
          if (sdata.status !== 'running' && sdata.status !== 'unknown') {
            if (sdata.result) setResults(sdata.result)
            if (sdata.files) setLibraryFiles(sdata.files)
            return
          }
          await delay(1000)
        }
        await fetchLibraryFiles().catch(() => {})
        return
      }
    } catch (e) {
      console.warn('Async simulation not available or failed, falling back to sync', e)
    }

    const res = await fetch(`${apiBaseUrl}/${id}/simulate`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setResults(data.results)
    setLibraryFiles(data.files)
  }, [apiBaseUrl, requireSession, setResults, setLibraryFiles, fetchLibraryFiles])

  return { runSimulation }
}
