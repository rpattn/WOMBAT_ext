import { useCallback } from 'react'
import type { JsonDict, LibraryFiles } from '../types'
import { b64toBlob } from '../utils/blob'
import { mockApiRequest } from '../workers/mockApiClient'
import { useToasts } from './useToasts'

let workerFallbackWarned_library = false

export type UseLibraryDeps = {
  apiBaseUrl: string
  requireSession: () => string
  setSavedLibraries: React.Dispatch<React.SetStateAction<string[]>>
  setLibraryFiles: React.Dispatch<React.SetStateAction<LibraryFiles | null>>
  setConfigData: React.Dispatch<React.SetStateAction<JsonDict>>
  setCsvPreview: React.Dispatch<React.SetStateAction<string | null>>
  setBinaryPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedFile: React.Dispatch<React.SetStateAction<string>>
}

export function useLibrary(deps: UseLibraryDeps) {
  const {
    apiBaseUrl,
    requireSession,
    setSavedLibraries,
    setLibraryFiles,
    setConfigData,
    setCsvPreview,
    setBinaryPreviewUrl,
    setSelectedFile,
  } = deps
  const { warning } = useToasts()

  const fetchSavedLibraries = useCallback(async () => {
    // If session exists and is mock, go straight to worker
    try {
      const id = requireSession()
      if (id && id.startsWith('mock-')) {
        const wr = await mockApiRequest('GET', '/api/saved')
        if (wr.ok) {
          setSavedLibraries(wr.json?.dirs ?? [])
          if (!workerFallbackWarned_library) {
            workerFallbackWarned_library = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
          return
        }
      }
    } catch {
      // no session yet; fall back to server attempt below
    }
    try {
      const res = await fetch(`${apiBaseUrl}/saved`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSavedLibraries(data.dirs ?? [])
    } catch {
      const wr = await mockApiRequest('GET', '/api/saved')
      if (wr.ok) {
        setSavedLibraries(wr.json?.dirs ?? [])
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
      }
    }
  }, [apiBaseUrl, setSavedLibraries, requireSession])

  const fetchLibraryFiles = useCallback(async () => {
    const id = requireSession()
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest('GET', `/api/${id}/library/files`)
        if (wr.ok) {
          setLibraryFiles(wr.json?.files ?? wr.json)
          if (!workerFallbackWarned_library) {
            workerFallbackWarned_library = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
          return
        }
      }
      const res = await fetch(`${apiBaseUrl}/${id}/library/files`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setLibraryFiles(data?.files ?? data)
    } catch {
      const wr = await mockApiRequest('GET', `/api/${id}/library/files`)
      if (wr.ok) {
        setLibraryFiles(wr.json?.files ?? wr.json)
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          //warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
      }
    }
  }, [apiBaseUrl, requireSession, setLibraryFiles])

  const getConfig = useCallback(async () => {
    const id = requireSession()
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest('GET', `/api/${id}/config`)
        if (wr.ok) {
          setConfigData(wr.json ?? {})
          if (!workerFallbackWarned_library) {
            workerFallbackWarned_library = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
          return
        }
      }
      const res = await fetch(`${apiBaseUrl}/${id}/config`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setConfigData(data ?? {})
    } catch {
      const wr = await mockApiRequest('GET', `/api/${id}/config`)
      if (wr.ok) {
        setConfigData(wr.json ?? {})
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
      }
    }
  }, [apiBaseUrl, requireSession, setConfigData])

  const readFile = useCallback(async (path: string, raw = false) => {
    const id = requireSession()
    const url = new URL(`${apiBaseUrl}/${id}/library/file`)
    url.searchParams.set('path', path)
    url.searchParams.set('raw', String(raw))
    let data: any
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest('GET', `/api/${id}/library/file?path=${encodeURIComponent(path)}&raw=${String(raw)}`)
        if (!wr.ok) throw new Error(wr.error || 'mock readFile failed')
        const data = wr.json
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
        // continue to common post-processing below
        if (raw && 'data_b64' in data) {
          const blob = b64toBlob(data.data_b64, data.mime || 'application/octet-stream')
          const objectUrl = URL.createObjectURL(blob)
          setBinaryPreviewUrl(objectUrl)
          setCsvPreview(null)
        } else if (raw && 'data' in data) {
          const file = String(data.file || path)
          const lf = file.toLowerCase()
          if (lf.endsWith('.html') || lf.endsWith('.csv') || lf.endsWith('.yaml') || lf.endsWith('.yml')) {
            setCsvPreview(String(data.data ?? ''))
            setBinaryPreviewUrl(null)
          }
        } else if (!raw) {
          const file = String(data.file || path)
          if (file.toLowerCase().endsWith('.csv')) {
            setCsvPreview(String(data.data ?? ''))
            setBinaryPreviewUrl(null)
          } else if (file.toLowerCase().endsWith('.yaml') || file.toLowerCase().endsWith('.yml')) {
            setConfigData(data.data ?? {})
          }
        }
        setSelectedFile(path)
        return
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error(await res.text())
      data = await res.json()
    } catch {
      const wr = await mockApiRequest('GET', `/api/${id}/library/file?path=${encodeURIComponent(path)}&raw=${String(raw)}`)
      if (!wr.ok) throw new Error(wr.error || 'mock readFile failed')
      data = wr.json
      if (!workerFallbackWarned_library) {
        workerFallbackWarned_library = true
        warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
      }
    }
    if (raw && 'data_b64' in data) {
      // Binary content provided as base64 (e.g., PNG)
      const blob = b64toBlob(data.data_b64, data.mime || 'application/octet-stream')
      const objectUrl = URL.createObjectURL(blob)
      setBinaryPreviewUrl(objectUrl)
      setCsvPreview(null)
    } else if (raw && 'data' in data) {
      // Raw text content (e.g., HTML, CSV, YAML)
      const file = String(data.file || path)
      const lf = file.toLowerCase()
      if (lf.endsWith('.html') || lf.endsWith('.csv') || lf.endsWith('.yaml') || lf.endsWith('.yml')) {
        setCsvPreview(String(data.data ?? ''))
        // Clear binary preview URL for text-based files
        setBinaryPreviewUrl(null)
      }
    } else if (!raw) {
      const file = String(data.file || path)
      if (file.toLowerCase().endsWith('.csv')) {
        setCsvPreview(String(data.data ?? ''))
        setBinaryPreviewUrl(null)
      } else if (file.toLowerCase().endsWith('.yaml') || file.toLowerCase().endsWith('.yml')) {
        setConfigData(data.data ?? {})
      }
    }
    setSelectedFile(path)
  }, [apiBaseUrl, requireSession, setBinaryPreviewUrl, setCsvPreview, setConfigData, setSelectedFile])

  const addOrReplaceFile = useCallback(async (file_path: string, content: any) => {
    const id = requireSession()
    const method = 'PUT'
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest(method, `/api/${id}/library/file`, { file_path, content })
        if (wr.ok) {
          setLibraryFiles(wr.json?.files ?? null)
          if (!workerFallbackWarned_library) {
            workerFallbackWarned_library = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
          return
        }
      }
      const res = await fetch(`${apiBaseUrl}/${id}/library/file`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path, content }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setLibraryFiles(data.files)
    } catch {
      const wr = await mockApiRequest(method, `/api/${id}/library/file`, { file_path, content })
      if (wr.ok) {
        setLibraryFiles(wr.json?.files ?? null)
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
      }
    }
  }, [apiBaseUrl, requireSession, setLibraryFiles])

  const deleteFile = useCallback(async (file_path: string) => {
    const id = requireSession()
    const url = new URL(`${apiBaseUrl}/${id}/library/file`)
    url.searchParams.set('file_path', file_path)
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest('DELETE', `/api/${id}/library/file?file_path=${encodeURIComponent(file_path)}`)
        if (wr.ok) {
          setLibraryFiles(wr.json?.files ?? null)
          if (!workerFallbackWarned_library) {
            workerFallbackWarned_library = true
            warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
          }
          return
        }
      }
      const res = await fetch(url.toString(), { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setLibraryFiles(data.files)
    } catch {
      const wr = await mockApiRequest('DELETE', `/api/${id}/library/file?file_path=${encodeURIComponent(file_path)}`)
      if (wr.ok) {
        setLibraryFiles(wr.json?.files ?? null)
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
      }
    }
  }, [apiBaseUrl, requireSession, setLibraryFiles])

  const saveLibrary = useCallback(async (project_name: string) => {
    const id = requireSession()
    try {
      if (id.startsWith('mock-')) {
        await mockApiRequest('POST', `/api/${id}/library/save`, { project_name })
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
        await fetchSavedLibraries()
        return
      }
      const res = await fetch(`${apiBaseUrl}/${id}/library/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name }),
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchSavedLibraries()
    } catch {
      await mockApiRequest('POST', `/api/${id}/library/save`, { project_name })
      if (!workerFallbackWarned_library) {
        workerFallbackWarned_library = true
        warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
      }
      await fetchSavedLibraries()
    }
  }, [apiBaseUrl, requireSession, fetchSavedLibraries])

  const loadSaved = useCallback(async (name: string) => {
    const id = requireSession()
    let filesResp: any = null
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest('POST', `/api/${id}/saved/load`, { name })
        if (!wr.ok) throw new Error(wr.error || 'mock loadSaved failed')
        filesResp = wr.json
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
        setLibraryFiles(filesResp.files)
        await Promise.allSettled([fetchSavedLibraries()])
        const basePath = 'project\\config\\base.yaml'
        try {
          setSelectedFile(basePath)
          await readFile(basePath, false)
        } catch {}
        return
      }
      const res = await fetch(`${apiBaseUrl}/${id}/saved/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(await res.text())
      filesResp = await res.json()
    } catch {
      const wr = await mockApiRequest('POST', `/api/${id}/saved/load`, { name })
      if (!wr.ok) throw new Error(wr.error || 'mock loadSaved failed')
      filesResp = wr.json
      if (!workerFallbackWarned_library) {
        workerFallbackWarned_library = true
        warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
      }
    }
    setLibraryFiles(filesResp.files)
    await Promise.allSettled([fetchSavedLibraries()])
    const basePath = 'project\\config\\base.yaml'
    try {
      setSelectedFile(basePath)
      await readFile(basePath, false)
    } catch {}
  }, [apiBaseUrl, requireSession, fetchSavedLibraries, setLibraryFiles, setSelectedFile, readFile])

  const restoreWorking = useCallback(async () => {
    const id = requireSession()
    try {
      if (id.startsWith('mock-')) {
        // No-op for mock; just refresh files from worker
        await fetchLibraryFiles()
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
        return
      }
      const res = await fetch(`${apiBaseUrl}/${id}/working/restore`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setLibraryFiles(data.files ?? null)
    } catch {
      // Fallback: attempt to refresh file list
      await fetchLibraryFiles()
    }
  }, [apiBaseUrl, requireSession, fetchLibraryFiles, setLibraryFiles, warning])

  const deleteSaved = useCallback(async (name: string) => {
    try {
      const id = requireSession()
      if (id && id.startsWith('mock-')) {
        await mockApiRequest('DELETE', `/api/saved/${encodeURIComponent(name)}`)
        if (!workerFallbackWarned_library) {
          workerFallbackWarned_library = true
          warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
        }
        await fetchSavedLibraries()
        return
      }
    } catch {
      // no session available yet; continue to server attempt
    }
    try {
      const res = await fetch(`${apiBaseUrl}/saved/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      await fetchSavedLibraries()
    } catch {
      await mockApiRequest('DELETE', `/api/saved/${encodeURIComponent(name)}`)
      if (!workerFallbackWarned_library) {
        workerFallbackWarned_library = true
        warning('Server unavailable. Using mock Web Worker. Some behavior may be unexpected.')
      }
      await fetchSavedLibraries()
    }
  }, [apiBaseUrl, fetchSavedLibraries, requireSession])

  return {
    fetchSavedLibraries,
    fetchLibraryFiles,
    getConfig,
    readFile,
    addOrReplaceFile,
    deleteFile,
    saveLibrary,
    loadSaved,
    deleteSaved,
    restoreWorking,
  }
}
