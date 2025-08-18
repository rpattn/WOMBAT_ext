// Lightweight API helpers for listing and reading files.
// These wrap server endpoints and transparently fall back to the mock Web Worker
// when the session ID begins with "mock-" or when HTTP is unavailable.
import { mockApiRequest } from '../workers/mockApiClient'

export type FileList = {
  yaml_files: string[]
  csv_files: string[]
  total_files: number
}

export async function listFiles(apiBaseUrl: string, requireSession: () => string): Promise<FileList | null> {
  const sid = requireSession()
  try {
    if (sid.startsWith('mock-')) {
      const wr = await mockApiRequest('GET', `/api/${sid}/library/files`)
      if (wr.ok) return wr.json as FileList
      return null
    }
    const r = await fetch(`${apiBaseUrl}/${sid}/library/files`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    return j?.files ?? null
  } catch {
    // network down or server missing -> try worker as a fallback
    try {
      const wr = await mockApiRequest('GET', `/api/${sid}/library/files`)
      if (wr.ok) return wr.json as FileList
    } catch {}
    return null
  }
}

export type ReadFileResult = {
  file: string
  data?: any
  data_b64?: string
  mime?: string
  raw?: boolean
}

export async function readFile(apiBaseUrl: string, requireSession: () => string, path: string, raw = false): Promise<ReadFileResult | null> {
  const sid = requireSession()
  try {
    if (sid.startsWith('mock-')) {
      const q = new URLSearchParams()
      q.set('path', path)
      q.set('raw', String(raw))
      const wr = await mockApiRequest('GET', `/api/${sid}/library/file?${q.toString()}`)
      if (wr.ok) return wr.json as ReadFileResult
      return null
    }
    const url = new URL(`${apiBaseUrl}/${sid}/library/file`)
    url.searchParams.set('path', path)
    url.searchParams.set('raw', String(raw))
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } catch {
    // network down -> try worker fallback
    try {
      const q = new URLSearchParams()
      q.set('path', path)
      q.set('raw', String(raw))
      const wr = await mockApiRequest('GET', `/api/${sid}/library/file?${q.toString()}`)
      if (wr.ok) return wr.json as ReadFileResult
    } catch {}
    return null
  }
}

export async function triggerRun(apiBaseUrl: string, requireSession: () => string): Promise<{ status: string; results?: any; files?: FileList } | null> {
  const sid = requireSession()
  const r = await fetch(`${apiBaseUrl}/${sid}/simulate`, { method: 'POST' })
  if (!r.ok) return null
  return await r.json()
}
