import { useEffect, useMemo, useRef, useState } from 'react'
import PageWithLibrary from '../components/PageWithLibrary'
import FileSelector from '../components/FileSelector'
import { useApiContext } from '../context/ApiContext'
import { listFiles, listSavedFiles, readFile, readSavedFile, type FileList } from '../api'

// Minimal CSV parser for '|' separated values
function parsePipeCsv(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return { columns: [], rows: [] }
  const columns = lines[0].split('|').map(s => s.trim())
  const rows = lines.slice(1).map(l => l.split('|').map(s => s.trim()))
  return { columns, rows }
}

export default function Operations() {
  const {
    apiBaseUrl,
    sessionId,
    initSession,
    savedLibraries,
    selectedSavedLibrary,
    libraryFiles,
  } = useApiContext()

  const requireSession = () => {
    if (!sessionId) throw new Error('No session')
    return sessionId
    }

  const [files, setFiles] = useState<FileList | null>(null)
  const [selectedLibs, setSelectedLibs] = useState<string[]>([])
  const [savedLibFiles, setSavedLibFiles] = useState<Record<string, FileList>>({})
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Data derived from CSV
  const [loadedRun, setLoadedRun] = useState<string>('')
  const [envTimes, setEnvTimes] = useState<number[]>([])
  const [envDatetimes, setEnvDatetimes] = useState<Date[]>([])
  const [farmAvail, setFarmAvail] = useState<number[]>([])
  const [perSystemLostHours, setPerSystemLostHours] = useState<{ id: string; lost: number; availability: number }[]>([])

  useEffect(() => {
    ;(async () => {
      if (!sessionId) await initSession()
      try {
        const f = await listFiles(apiBaseUrl, requireSession)
        setFiles(f)
      } catch {
        setFiles(null)
      }
    })()
  }, [apiBaseUrl, sessionId, initSession, selectedSavedLibrary, libraryFiles])

  // Load file lists for selected saved libraries
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const out: Record<string, FileList> = {}
      for (const name of selectedLibs) {
        const f = await listSavedFiles(apiBaseUrl, name)
        if (f) out[name] = f
      }
      if (!cancelled) setSavedLibFiles(out)
    })()
    return () => { cancelled = true }
  }, [apiBaseUrl, selectedLibs])

  // Combine current and saved lib files, only under results/
  const resultsOnlyFiles = useMemo(() => {
    if (!files) return undefined
    const re = /^(?:results[\\/])/i
    const base = {
      yaml_files: [],
      csv_files: (files.csv_files || []).filter(p => re.test(p)),
      total_files: undefined as any,
    }
    for (const lib of Object.keys(savedLibFiles)) {
      const libFiles = savedLibFiles[lib]
      const addPref = (arr?: string[]) => (arr || []).filter(p => re.test(p)).map(p => `${lib}/${p}`)
      base.csv_files = base.csv_files.concat(addPref(libFiles.csv_files))
    }
    return base
  }, [files, savedLibFiles])

  // Filter to operations.csv only
  const operationCsvFiles = useMemo(() => {
    if (!resultsOnlyFiles) return undefined
    const filt = (resultsOnlyFiles.csv_files || []).filter(p => /operations\.csv$/i.test(p))
    return { yaml_files: [], csv_files: filt, total_files: filt.length }
  }, [resultsOnlyFiles])

  // Auto-expand first results subfolder
  const defaultExpand = useMemo(() => {
    const base = ['results'] as string[]
    const all = (operationCsvFiles?.csv_files || [])
    const subs = new Set<string>()
    for (const p of all) {
      const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean)
      if (parts[0] && parts[1] === 'results' && parts[2]) {
        subs.add(`${parts[0]}/results/${parts[2]}`)
      } else if (parts[0] === 'results' && parts[1]) {
        subs.add(`results/${parts[1]}`)
      }
    }
    const first = Array.from(subs).sort()[0]
    if (first) base.push(first)
    return base
  }, [operationCsvFiles])

  async function loadSelected() {
    const path = selectedPath
    if (!path) return
    // Detect if path is prefixed with a saved library name "lib/path"
    const norm = String(path).replace(/\\/g, '/')
    const parts = norm.split('/')
    let rf = null as any
    let runPrefix = ''
    if (parts.length > 1 && savedLibraries.includes(parts[0])) {
      const lib = parts.shift() as string
      const inner = parts.join('/')
      rf = await readSavedFile(apiBaseUrl, lib, inner, true)
      runPrefix = lib + ': '
    } else {
      rf = await readFile(apiBaseUrl, requireSession, path, true)
    }
    if (!rf) return
    const text = String(rf.data ?? '')
    const { columns, rows } = parsePipeCsv(text)
    if (columns.length === 0) return

    // Identify columns
    const timeIx = columns.indexOf('env_time')
    const dtIx = columns.indexOf('env_datetime')
    const sysCols = columns.filter(c => !['datetime', 'env_datetime', 'env_time'].includes(c))

    // Parse rows
    const envT: number[] = []
    const envDT: Date[] = []
    const series: number[][] = sysCols.map(() => [])

    for (const r of rows) {
      if (!r || r.length !== columns.length) continue
      const t = timeIx >= 0 ? Number(r[timeIx]) : NaN
      const dt = dtIx >= 0 ? new Date(r[dtIx]) : new Date()
      envT.push(Number.isFinite(t) ? t : NaN)
      envDT.push(dt)
      for (let i = 0; i < sysCols.length; i++) {
        const val = Number(r[columns.indexOf(sysCols[i])])
        series[i].push(Number.isFinite(val) ? val : NaN)
      }
    }

    // Farm availability (equal-weight mean across systems)
    const farm = envT.map((_, row) => {
      let sum = 0, cnt = 0
      for (let i = 0; i < sysCols.length; i++) {
        const v = series[i][row]
        if (Number.isFinite(v)) { sum += v; cnt++ }
      }
      return cnt > 0 ? (sum / cnt) : NaN
    })

    // Per-system lost hours and availability
    const per = sysCols.map((id, i) => {
      let lost = 0
      let upCount = 0
      for (const v of series[i]) {
        if (Number.isFinite(v)) {
          lost += (1 - v)
          if (v >= 1.0) upCount += 1
        }
      }
      return { id, lost, availability: upCount / Math.max(1, series[i].length) }
    }).sort((a, b) => b.lost - a.lost)

    setLoadedRun(runPrefix + (parts.slice(-2).join('/') || path))
    setEnvTimes(envT)
    setEnvDatetimes(envDT)
    setFarmAvail(farm)
    setPerSystemLostHours(per)
  }

  // Plotly line chart for farm availability
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setThemeMode(e.matches ? 'dark' : 'light')
    try { mq.addEventListener('change', handler) } catch { mq.addListener(handler) }
    return () => { try { mq.removeEventListener('change', handler) } catch { mq.removeListener(handler) } }
  }, [])
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!plotRef.current) return
      if (farmAvail.length === 0) {
        try {
          const Plotly = (await import('plotly.js-dist-min')).default
          await Plotly.purge(plotRef.current)
        } catch {}
        return
      }
      const Plotly = (await import('plotly.js-dist-min')).default
      const root = getComputedStyle(document.documentElement)
      const surface = (root.getPropertyValue('--color-surface') || '').trim() || (themeMode === 'dark' ? '#111827' : '#ffffff')
      const text = (root.getPropertyValue('--color-text') || '').trim() || (themeMode === 'dark' ? '#E5E7EB' : '#111827')
      const border = (root.getPropertyValue('--color-border') || '').trim() || (themeMode === 'dark' ? '#374151' : '#E5E7EB')

      const x = envDatetimes.length ? envDatetimes : envTimes
      const traces = [{
        x,
        y: farmAvail,
        type: 'scatter',
        mode: 'lines',
        name: 'Farm availability',
        hovertemplate: '%{x|%Y-%m-%d %H:%M}: %{y:.3f}<extra></extra>'
      }] as any

      const layout = {
        title: 'Farm Availability (equal-weighted)',
        margin: { l: 60, r: 20, t: 40, b: 60 },
        paper_bgcolor: surface,
        plot_bgcolor: surface,
        font: { color: text },
        xaxis: { title: envDatetimes.length ? 'Time' : 'Env Hours', gridcolor: border, zerolinecolor: border, linecolor: border, tickcolor: border },
        yaxis: { title: 'Availability', range: [0, 1.05], gridcolor: border, zerolinecolor: border, linecolor: border, tickcolor: border },
      } as any
      const config = { responsive: true, displaylogo: false } as any
      await Plotly.newPlot(plotRef.current, traces, layout, config)
      if (!mounted) {
        await Plotly.purge(plotRef.current)
      }
    })()
    return () => { mounted = false }
  }, [envTimes, envDatetimes, farmAvail, themeMode])

  return (
    <PageWithLibrary
      title="Operations"
      projectPlacement="sidebar"
      sidebar={(
        <>
          <h3 className="panel-title">Browse Files</h3>
          <div className="panel-body">
            <details>
              <summary style={{ fontWeight: 600 }}>Saved projects to include</summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {savedLibraries.length === 0 ? (
                  <small>No saved libraries found.</small>
                ) : (
                  savedLibraries.map((lib) => (
                    <label key={lib} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={selectedLibs.includes(lib)}
                        onChange={() => setSelectedLibs(s => s.includes(lib) ? s.filter(x => x !== lib) : [...s, lib])}
                      />
                      <span>{lib}</span>
                    </label>
                  ))
                )}
              </div>
            </details>
            <FileSelector
              projectName={(selectedSavedLibrary || 'Library Files') + (selectedLibs.length ? ` + ${selectedLibs.length} saved` : '')}
              libraryFiles={operationCsvFiles}
              selectedFile={selectedPath || undefined}
              onFileSelect={(path: string) => {
                const isCsv = /\.csv$/i.test(path)
                const isOps = /operations\.csv$/i.test(path)
                const inResults = /^(?:[^/]+\/)?results[\\/]/i.test(path)
                if (isCsv && isOps && inResults) {
                  setSelectedPath(path)
                }
              }}
              showActions={false}
              defaultExpandFolders={defaultExpand}
            />
            <div className="controls" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={loadSelected} disabled={!selectedPath}>Load Selected</button>
              <button className="btn btn-secondary" onClick={() => { setSelectedPath(null); setLoadedRun(''); setEnvTimes([]); setEnvDatetimes([]); setFarmAvail([]); setPerSystemLostHours([]) }}>Clear</button>
              <span style={{ marginLeft: 'auto' }}>{selectedPath ? 1 : 0} selected</span>
            </div>
          </div>
        </>
      )}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Farm availability</h3>
        {loadedRun ? <small style={{ opacity: 0.8 }}>Source: {loadedRun}</small> : null}
      </div>
      <div ref={plotRef} style={{ width: '100%', height: 420, background: 'var(--color-surface)', marginTop: 8 }} />

      <details style={{ marginTop: 16 }} open>
        <summary style={{ fontWeight: 600 }}>Top turbines by lost hours</summary>
        <div style={{ marginTop: 8, overflow: 'auto', maxHeight: 320 }}>
          {perSystemLostHours.length === 0 ? (
            <div>No data loaded.</div>
          ) : (
            <table className="table-compact">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Lost hours</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {perSystemLostHours.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.lost.toFixed(2)}</td>
                    <td>{(row.availability * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      <details style={{ marginTop: 8 }}>
        <summary>Debug</summary>
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{JSON.stringify({ selectedPath, rows: farmAvail.length }, null, 2)}</pre>
      </details>
    </PageWithLibrary>
  )
}
