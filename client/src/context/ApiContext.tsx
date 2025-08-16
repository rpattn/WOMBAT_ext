import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import type { JsonObject } from '../components/JsonEditor'

export type ApiContextType = {
  // REST base
  apiBaseUrl: string
  setApiBaseUrl: (v: string) => void

  // Session
  sessionId: string | null
  initSession: () => Promise<string | null>
  endSession: () => Promise<void>

  // Shared data
  libraryFiles: { yaml_files: string[]; csv_files: string[]; html_files?: string[]; png_files?: string[]; total_files?: number } | null
  setLibraryFiles: React.Dispatch<React.SetStateAction<{ yaml_files: string[]; csv_files: string[]; html_files?: string[]; png_files?: string[]; total_files?: number } | null>>
  savedLibraries: string[]
  setSavedLibraries: React.Dispatch<React.SetStateAction<string[]>>
  selectedSavedLibrary: string
  setSelectedSavedLibrary: React.Dispatch<React.SetStateAction<string>>
  selectedFile: string
  setSelectedFile: React.Dispatch<React.SetStateAction<string>>
  configData: JsonObject
  setConfigData: React.Dispatch<React.SetStateAction<JsonObject>>
  csvPreview: string | null
  setCsvPreview: React.Dispatch<React.SetStateAction<string | null>>
  binaryPreviewUrl?: string | null
  setBinaryPreviewUrl?: React.Dispatch<React.SetStateAction<string | null>>
  pendingDownloadRef: React.MutableRefObject<string | null>

  // Results
  results: any | null
  setResults: React.Dispatch<React.SetStateAction<any | null>>

  // API helpers
  refreshAll: () => Promise<void>
  getConfig: () => Promise<void>
  fetchLibraryFiles: () => Promise<void>
  fetchSavedLibraries: () => Promise<void>
  readFile: (path: string, raw?: boolean) => Promise<void>
  addOrReplaceFile: (file_path: string, content: any) => Promise<void>
  deleteFile: (file_path: string) => Promise<void>
  saveLibrary: (project_name: string) => Promise<void>
  loadSaved: (name: string) => Promise<void>
  deleteSaved: (name: string) => Promise<void>
  runSimulation: () => Promise<void>
}

const ApiContext = createContext<ApiContextType | undefined>(undefined)

export function ApiProvider({ children }: PropsWithChildren) {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>((import.meta as any).env?.VITE_API_URL ?? 'http://127.0.0.1:8000/api')
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Shared data state (mirrors WebSocketContext)
  const [libraryFiles, setLibraryFiles] = useState<ApiContextType['libraryFiles']>(null)
  const [savedLibraries, setSavedLibraries] = useState<string[]>([])
  const [selectedSavedLibrary, setSelectedSavedLibrary] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [configData, setConfigData] = useState<JsonObject>({})
  const [csvPreview, setCsvPreview] = useState<string | null>(null)
  const [binaryPreviewUrl, setBinaryPreviewUrl] = useState<string | null>(null)
  const pendingDownloadRef = useRef<string | null>(null)
  const [results, setResults] = useState<any | null>(null)

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
      // Kick off unified refresh after session is set.
      setTimeout(() => {
        ;(async () => {
          try {
            const id = data.client_id as string
            const r = await fetch(`${apiBaseUrl}/${id}/refresh`)
            if (r.ok) {
              const payload = await r.json()
              setLibraryFiles(payload.files ?? null)
              setConfigData(payload.config ?? {})
              setSavedLibraries(payload.saved ?? [])
            } else {
              // fallback to individual calls if refresh not supported server-side
              await Promise.allSettled([
                fetchSavedLibraries(),
                fetchLibraryFiles(),
                getConfig(),
              ])
            }
          } catch {
            // ignore
          }
        })()
      }, 0)
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
      setLibraryFiles(null)
      setSavedLibraries([])
      setConfigData({})
      setCsvPreview(null)
      setBinaryPreviewUrl(null)
      setResults(null)
    }
  }, [apiBaseUrl, requireSession])

  const fetchSavedLibraries = useCallback(async () => {
    const res = await fetch(`${apiBaseUrl}/saved`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setSavedLibraries(data.dirs ?? [])
  }, [apiBaseUrl])

  const fetchLibraryFiles = useCallback(async () => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/library/files`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setLibraryFiles(data)
  }, [apiBaseUrl, requireSession])

  const getConfig = useCallback(async () => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/config`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setConfigData(data ?? {})
  }, [apiBaseUrl, requireSession])

  const readFile = useCallback(async (path: string, raw = false) => {
    const id = requireSession()
    const url = new URL(`${apiBaseUrl}/${id}/library/file`)
    url.searchParams.set('path', path)
    url.searchParams.set('raw', String(raw))
    const res = await fetch(url)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    // Update previews
    if (raw && 'data_b64' in data) {
      // Binary: create object URL
      const blob = b64toBlob(data.data_b64, data.mime || 'application/octet-stream')
      const objectUrl = URL.createObjectURL(blob)
      setBinaryPreviewUrl?.(objectUrl)
      setCsvPreview(null)
    } else if (raw && 'data' in data) {
      // Textual raw content (e.g., .html). Store in csvPreview for iframe rendering path.
      const file = String(data.file || path)
      if (file.toLowerCase().endsWith('.html')) {
        setCsvPreview(String(data.data ?? ''))
        setBinaryPreviewUrl?.(null)
      }
    } else if (!raw) {
      const file = String(data.file || path)
      if (file.toLowerCase().endsWith('.csv')) {
        setCsvPreview(String(data.data ?? ''))
        setBinaryPreviewUrl?.(null)
      } else if (file.toLowerCase().endsWith('.yaml') || file.toLowerCase().endsWith('.yml')) {
        setConfigData(data.data ?? {})
      }
    }
    setSelectedFile(path)
  }, [apiBaseUrl, requireSession])

  const addOrReplaceFile = useCallback(async (file_path: string, content: any) => {
    const id = requireSession()
    const method = 'PUT'
    const res = await fetch(`${apiBaseUrl}/${id}/library/file`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path, content }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setLibraryFiles(data.files)
  }, [apiBaseUrl, requireSession])

  const deleteFile = useCallback(async (file_path: string) => {
    const id = requireSession()
    const url = new URL(`${apiBaseUrl}/${id}/library/file`)
    url.searchParams.set('file_path', file_path)
    const res = await fetch(url.toString(), { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setLibraryFiles(data.files)
  }, [apiBaseUrl, requireSession])

  const saveLibrary = useCallback(async (project_name: string) => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/library/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_name }),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchSavedLibraries()
  }, [apiBaseUrl, requireSession, fetchSavedLibraries])

  const loadSaved = useCallback(async (name: string) => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/saved/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setLibraryFiles(data.files)
  }, [apiBaseUrl, requireSession])

  const deleteSaved = useCallback(async (name: string) => {
    const res = await fetch(`${apiBaseUrl}/saved/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    await fetchSavedLibraries()
  }, [apiBaseUrl, fetchSavedLibraries])

  const runSimulation = useCallback(async () => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/simulate`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setResults(data.results)
    setLibraryFiles(data.files)
  }, [apiBaseUrl, requireSession])

  const refreshAll = useCallback(async () => {
    const id = requireSession()
    const r = await fetch(`${apiBaseUrl}/${id}/refresh`)
    if (r.ok) {
      const payload = await r.json()
      setLibraryFiles(payload.files ?? null)
      setConfigData(payload.config ?? {})
      setSavedLibraries(payload.saved ?? [])
    } else {
      await Promise.allSettled([
        fetchSavedLibraries(),
        fetchLibraryFiles(),
        getConfig(),
      ])
    }
  }, [apiBaseUrl, requireSession, fetchSavedLibraries, fetchLibraryFiles, getConfig])

  const value = useMemo<ApiContextType>(() => ({
    apiBaseUrl,
    setApiBaseUrl,
    sessionId,
    initSession,
    endSession,

    libraryFiles,
    setLibraryFiles,
    savedLibraries,
    setSavedLibraries,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    selectedFile,
    setSelectedFile,
    configData,
    setConfigData,
    csvPreview,
    setCsvPreview,
    binaryPreviewUrl,
    setBinaryPreviewUrl,
    pendingDownloadRef,

    results,
    setResults,

    refreshAll,
    getConfig,
    fetchLibraryFiles,
    fetchSavedLibraries,
    readFile,
    addOrReplaceFile,
    deleteFile,
    saveLibrary,
    loadSaved,
    deleteSaved,
    runSimulation,
  }), [
    apiBaseUrl,
    sessionId,
    initSession,
    endSession,
    libraryFiles,
    savedLibraries,
    selectedSavedLibrary,
    selectedFile,
    configData,
    csvPreview,
    binaryPreviewUrl,
    results,
    refreshAll,
    getConfig,
    fetchLibraryFiles,
    fetchSavedLibraries,
    readFile,
    addOrReplaceFile,
    deleteFile,
    saveLibrary,
    loadSaved,
    deleteSaved,
    runSimulation,
  ])

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  )
}

export function useApiContext(): ApiContextType {
  const ctx = useContext(ApiContext)
  if (!ctx) throw new Error('useApiContext must be used within an ApiProvider')
  return ctx
}

// helpers
function b64toBlob(b64Data: string, contentType = '', sliceSize = 512) {
  const byteCharacters = atob(b64Data)
  const byteArrays = []

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)

    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  const blob = new Blob(byteArrays, { type: contentType })
  return blob
}
