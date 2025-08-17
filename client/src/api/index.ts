// Lightweight API helpers for listing and reading files for results comparison
// These wrap existing server endpoints so components can use a small, focused surface.

export type FileList = {
  yaml_files: string[]
  csv_files: string[]
  total_files: number
}

export async function listFiles(apiBaseUrl: string, requireSession: () => string): Promise<FileList | null> {
  const sid = requireSession()
  const r = await fetch(`${apiBaseUrl}/${sid}/library/files`)
  if (!r.ok) return null
  const j = await r.json()
  return j?.files ?? null
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
  const url = new URL(`${apiBaseUrl}/${sid}/library/file`)
  url.searchParams.set('path', path)
  url.searchParams.set('raw', String(raw))
  const r = await fetch(url)
  if (!r.ok) return null
  return await r.json()
}

export async function triggerRun(apiBaseUrl: string, requireSession: () => string): Promise<{ status: string; results?: any; files?: FileList } | null> {
  const sid = requireSession()
  const r = await fetch(`${apiBaseUrl}/${sid}/simulate`, { method: 'POST' })
  if (!r.ok) return null
  return await r.json()
}
