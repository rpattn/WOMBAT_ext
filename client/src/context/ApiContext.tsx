import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { mockApiRequest } from '../workers/mockApiClient'
import type { JsonDict, LibraryFiles } from '../types'
import { useSession } from '../hooks/useSession'
import { useLibrary } from '../hooks/useLibrary'
import { useSimulation } from '../hooks/useSimulation'
import { useTemp } from '../hooks/useTemp'

export type ApiContextType = {
  // REST base
  apiBaseUrl: string
  setApiBaseUrl: (v: string) => void

  // Session
  sessionId: string | null
  initSession: () => Promise<string | null>
  endSession: () => Promise<void>

  // Shared data
  libraryFiles: LibraryFiles | null
  setLibraryFiles: React.Dispatch<React.SetStateAction<LibraryFiles | null>>
  savedLibraries: string[]
  setSavedLibraries: React.Dispatch<React.SetStateAction<string[]>>
  selectedSavedLibrary: string
  setSelectedSavedLibrary: React.Dispatch<React.SetStateAction<string>>
  selectedFile: string
  setSelectedFile: React.Dispatch<React.SetStateAction<string>>
  configData: JsonDict
  setConfigData: React.Dispatch<React.SetStateAction<JsonDict>>
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
  restoreWorking: () => Promise<void>
  runSimulation: () => Promise<void>

  // Temp maintenance
  clearClientTemp: () => Promise<boolean>
  sweepTemp: () => Promise<number>
  sweepTempAll: () => Promise<number>

  // Schemas
  listSchemas: () => Promise<string[]>
  getSchema: (name: string) => Promise<any>
}

const ApiContext = createContext<ApiContextType | undefined>(undefined)

export function ApiProvider({ children }: PropsWithChildren) {
  const {
    apiBaseUrl,
    setApiBaseUrl,
    sessionId,
    initSession: initSessionBase,
    endSession: endSessionBase,
    requireSession,
  } = useSession((import.meta as any).env?.VITE_API_URL ?? 'http://127.0.0.1:8000/api')

  // Shared data state (mirrors WebSocketContext)
  const [libraryFiles, setLibraryFiles] = useState<ApiContextType['libraryFiles']>(null)
  const [savedLibraries, setSavedLibraries] = useState<string[]>([])
  const [selectedSavedLibrary, setSelectedSavedLibrary] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [configData, setConfigData] = useState<JsonDict>({})
  const [csvPreview, setCsvPreview] = useState<string | null>(null)
  const [binaryPreviewUrl, setBinaryPreviewUrl] = useState<string | null>(null)
  const pendingDownloadRef = useRef<string | null>(null)
  const [results, setResults] = useState<any | null>(null)

  // Compose feature hooks
  const {
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
  } = useLibrary({
    apiBaseUrl,
    requireSession,
    setSavedLibraries,
    setLibraryFiles,
    setConfigData,
    setCsvPreview,
    setBinaryPreviewUrl,
    setSelectedFile,
  })

  const { runSimulation } = useSimulation({
    apiBaseUrl,
    requireSession,
    setResults,
    setLibraryFiles,
    fetchLibraryFiles,
  })

  const { clearClientTemp, sweepTemp, sweepTempAll } = useTemp({ apiBaseUrl, requireSession })

  // Schema endpoints (no session required)
  const listSchemas = useCallback(async (): Promise<string[]> => {
    try {
      const r = await fetch(`${apiBaseUrl}/schemas/`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      const arr = Array.isArray(j) ? j : (Array.isArray(j.available) ? j.available : [])
      return arr
    } catch (e) {
      // Fallback to mock worker
      try {
        const wr = await mockApiRequest('GET', `/api/schemas`)
        if (wr.ok) {
          const arr = Array.isArray(wr.json) ? wr.json : (Array.isArray(wr.json?.available) ? wr.json.available : [])
          return arr
        }
      } catch {}
      return []
    }
  }, [apiBaseUrl])

  const getSchema = useCallback(async (name: string): Promise<any> => {
    try {
      const r = await fetch(`${apiBaseUrl}/schemas/${encodeURIComponent(name)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) {
      // Fallback to mock worker
      const wr = await mockApiRequest('GET', `/api/schemas/${encodeURIComponent(name)}`)
      if (wr.ok) return wr.json
      throw new Error(wr.error || 'Failed to fetch schema')
    }
  }, [apiBaseUrl])

  const initSession = useCallback(async () => {
    try {
      const id = await initSessionBase()
      if (!id) return null
      // Kick off unified refresh after session is set.
      setTimeout(() => {
        ;(async () => {
          try {
            const sid = id as string
            if (sid.startsWith('mock-')) {
              // Use worker refresh directly to avoid network error noise
              const wr = await mockApiRequest('GET', `/api/${sid}/refresh`)
              if (wr.ok) {
                setLibraryFiles(wr.json?.files ?? null)
                setConfigData(wr.json?.config ?? {})
                setSavedLibraries(wr.json?.saved ?? [])
                return
              }
              // fallback to individual worker-backed calls
              await Promise.allSettled([
                fetchSavedLibraries(),
                fetchLibraryFiles(),
                getConfig(),
              ])
              return
            }
            const r = await fetch(`${apiBaseUrl}/${sid}/refresh`)
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
            // Network error -> use worker-backed fallbacks
            await Promise.allSettled([
              fetchSavedLibraries(),
              fetchLibraryFiles(),
              getConfig(),
            ])
          }
        })()
      }, 0)
      return id
    } catch (e) {
      console.error('initSession error', e)
      return null
    }
  }, [apiBaseUrl, initSessionBase, fetchSavedLibraries, fetchLibraryFiles, getConfig])

  const endSession = useCallback(async () => {
    try {
      await endSessionBase()
    } finally {
      setLibraryFiles(null)
      setSavedLibraries([])
      setConfigData({})
      setCsvPreview(null)
      setBinaryPreviewUrl(null)
      setResults(null)
    }
  }, [endSessionBase])


  const refreshAll = useCallback(async () => {
    const id = requireSession()
    try {
      if (id.startsWith('mock-')) {
        const wr = await mockApiRequest('GET', `/api/${id}/refresh`)
        if (wr.ok) {
          setLibraryFiles(wr.json?.files ?? null)
          setConfigData(wr.json?.config ?? {})
          setSavedLibraries(wr.json?.saved ?? [])
          return
        }
        // worker refresh failed; fall back to individual calls
        await Promise.allSettled([
          fetchSavedLibraries(),
          fetchLibraryFiles(),
          getConfig(),
        ])
        return
      }
      const r = await fetch(`${apiBaseUrl}/${id}/refresh`)
      if (r.ok) {
        const payload = await r.json()
        setLibraryFiles(payload.files ?? null)
        setConfigData(payload.config ?? {})
        setSavedLibraries(payload.saved ?? [])
        return
      }
    } catch {
      // fall through to worker-backed fallbacks
    }
    await Promise.allSettled([
      fetchSavedLibraries(),
      fetchLibraryFiles(),
      getConfig(),
    ])
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
    restoreWorking,
    runSimulation,
    clearClientTemp,
    sweepTemp,
    sweepTempAll,

    listSchemas,
    getSchema,
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
    clearClientTemp,
    sweepTemp,
    sweepTempAll,

    listSchemas,
    getSchema,
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
