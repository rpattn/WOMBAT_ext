import { useCallback } from 'react'
import type { JsonDict, LibraryFiles } from '../types'
import { b64toBlob } from '../utils/blob'

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

  const fetchSavedLibraries = useCallback(async () => {
    const res = await fetch(`${apiBaseUrl}/saved`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setSavedLibraries(data.dirs ?? [])
  }, [apiBaseUrl, setSavedLibraries])

  const fetchLibraryFiles = useCallback(async () => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/library/files`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setLibraryFiles(data?.files ?? data)
  }, [apiBaseUrl, requireSession, setLibraryFiles])

  const getConfig = useCallback(async () => {
    const id = requireSession()
    const res = await fetch(`${apiBaseUrl}/${id}/config`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setConfigData(data ?? {})
  }, [apiBaseUrl, requireSession, setConfigData])

  const readFile = useCallback(async (path: string, raw = false) => {
    const id = requireSession()
    const url = new URL(`${apiBaseUrl}/${id}/library/file`)
    url.searchParams.set('path', path)
    url.searchParams.set('raw', String(raw))
    const res = await fetch(url)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    if (raw && 'data_b64' in data) {
      const blob = b64toBlob(data.data_b64, data.mime || 'application/octet-stream')
      const objectUrl = URL.createObjectURL(blob)
      setBinaryPreviewUrl(objectUrl)
      setCsvPreview(null)
    } else if (raw && 'data' in data) {
      const file = String(data.file || path)
      if (file.toLowerCase().endsWith('.html')) {
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
  }, [apiBaseUrl, requireSession, setBinaryPreviewUrl, setCsvPreview, setConfigData, setSelectedFile])

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
  }, [apiBaseUrl, requireSession, setLibraryFiles])

  const deleteFile = useCallback(async (file_path: string) => {
    const id = requireSession()
    const url = new URL(`${apiBaseUrl}/${id}/library/file`)
    url.searchParams.set('file_path', file_path)
    const res = await fetch(url.toString(), { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setLibraryFiles(data.files)
  }, [apiBaseUrl, requireSession, setLibraryFiles])

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
    await Promise.allSettled([fetchSavedLibraries()])
    const basePath = 'project\\config\\base.yaml'
    try {
      setSelectedFile(basePath)
      await readFile(basePath, false)
    } catch {}
  }, [apiBaseUrl, requireSession, fetchSavedLibraries, setLibraryFiles, setSelectedFile, readFile])

  const deleteSaved = useCallback(async (name: string) => {
    const res = await fetch(`${apiBaseUrl}/saved/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    await fetchSavedLibraries()
  }, [apiBaseUrl, fetchSavedLibraries])

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
  }
}
