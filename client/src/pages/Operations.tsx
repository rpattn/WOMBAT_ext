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
  // Events
  const [events, setEvents] = useState<{ time: Date; envTime: number; system: string; action: string; reason: string; location: string; requestId: string }[]>([])
  const [plotEvents, setPlotEvents] = useState<boolean>(true)

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
    const text = typeof rf.data === 'string' ? rf.data : (rf.data_b64 ? atob(rf.data_b64) : '')
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

    // Attempt to load the sibling events.csv
    try {
      const evPath = norm.replace(/operations\.csv$/i, 'events.csv')
      const evParts = evPath.split('/')
      let evRes = null as any
      if (savedLibraries.includes(evParts[0] || '')) {
        const lib = evParts.shift() as string
        const inner = evParts.join('/')
        evRes = await readSavedFile(apiBaseUrl, lib, inner, true)
      } else {
        evRes = await readFile(apiBaseUrl, requireSession, evPath, true)
      }
      if (evRes && (typeof evRes.data === 'string' || typeof evRes.data_b64 === 'string')) {
        const evText = typeof evRes.data === 'string' ? evRes.data : (evRes.data_b64 ? atob(evRes.data_b64) : '')
        const { columns: ecols, rows: erows } = parsePipeCsv(evText)
        const tIx = ecols.indexOf('env_datetime')
        const etIx = ecols.indexOf('env_time')
        const sysIx = ecols.indexOf('system_id')
        const actIx = ecols.indexOf('action')
        const reaIx = ecols.indexOf('reason')
        const locIx = ecols.indexOf('location')
        const reqIx = ecols.indexOf('request_id')
        const out: { time: Date; envTime: number; system: string; action: string; reason: string; location: string; requestId: string }[] = []
        for (const r of erows) {
          if (!r || r.length !== ecols.length) continue
          const dt = tIx >= 0 ? new Date(r[tIx]) : new Date()
          const etRaw = etIx >= 0 ? Number(r[etIx]) : NaN
          const action = (actIx >= 0 ? String(r[actIx]) : '').trim()
          const reason = (reaIx >= 0 ? String(r[reaIx]) : '').trim()
          const location = (locIx >= 0 ? String(r[locIx]) : '').trim()
          // Filter out noisy 'n/a delay' style rows
          const isNA = (s: string) => s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a'
          if (action.toLowerCase() === 'delay' && (isNA(reason) || isNA(location))) continue
          out.push({
            time: dt,
            envTime: Number.isFinite(etRaw) ? etRaw : NaN,
            system: sysIx >= 0 ? String(r[sysIx]).trim() : '',
            action,
            reason: isNA(reason) ? '' : reason,
            location: isNA(location) ? '' : location,
            requestId: reqIx >= 0 ? String(r[reqIx]).trim() : '',
          })
        }
        // Keep only MAJOR events at load time to reduce memory/overplotting
        const MAJOR = /(fail|fault|repair|replace|replac|damage|break|trip|down|restore|startup|commission|decommission|tow|jack|cable|substation|transformer|grid|outage)/i
        const majorOnly = out.filter(e => MAJOR.test(e.action) || MAJOR.test(e.reason))
        majorOnly.sort((a, b) => a.time.getTime() - b.time.getTime())
        setEvents(majorOnly)
      } else {
        setEvents([])
      }
    } catch {
      setEvents([])
    }
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

      const usingDates = envDatetimes.length > 0
      const x = usingDates ? envDatetimes : envTimes
      const traces: any[] = [{
        x,
        y: farmAvail,
        type: 'scatter',
        mode: 'lines',
        name: 'Farm availability',
        hovertemplate: usingDates ? '%{x|%Y-%m-%d %H:%M}: %{y:.3f}<extra></extra>' : 'h %{x:.2f}: %{y:.3f}<extra></extra>'
      }]

      // Event markers (limit to avoid overplotting)
      const haveTimes = usingDates
      let evs: typeof events = []
      if (plotEvents) {
        const evsSource = events
        // Only plot repair requests (heuristic): has non-na requestId OR action/reason mentions repair/request
        const isNA = (s: string) => !s || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a'
        const REPAIR_REQ = /(repair|request|repair request)/i
        const filtered = evsSource.filter(e => !isNA(e.requestId) || REPAIR_REQ.test(e.action) || REPAIR_REQ.test(e.reason))
        // If numeric axis, only keep events with finite envTime
        evs = haveTimes ? filtered : filtered.filter(e => Number.isFinite(e.envTime))
      }
      if (evs.length > 0) {
        const ex = haveTimes ? evs.map(e => e.time) : evs.map(e => e.envTime)
        // Map each event to nearest farm availability Y for hover
        const y: number[] = []
        if (haveTimes) {
          for (const e of evs) {
            let best = 0, bestDiff = Infinity
            for (let i = 0; i < envDatetimes.length; i++) {
              const d = Math.abs(envDatetimes[i].getTime() - e.time.getTime())
              if (d < bestDiff) { bestDiff = d; best = i }
            }
            y.push(farmAvail[best] ?? NaN)
          }
        } else {
          for (const e of evs) {
            let best = 0, bestDiff = Infinity
            for (let i = 0; i < envTimes.length; i++) {
              const d = Math.abs(envTimes[i] - e.envTime)
              if (d < bestDiff) { bestDiff = d; best = i }
            }
            y.push(farmAvail[best] ?? NaN)
          }
        }
        traces.push({
          x: ex,
          y,
          type: 'scatter',
          mode: 'markers',
          name: 'Repair requests',
          marker: { size: 6, color: 'crimson', symbol: 'circle' },
          text: evs.map(e => `${e.system || ''}${e.system ? ' | ' : ''}${e.action}${e.reason ? ' – ' + e.reason : ''}${!e.requestId ? '' : ` (#${e.requestId})`}`),
          hovertemplate: (haveTimes ? '%{x|%Y-%m-%d %H:%M} — ' : 'h %{x:.2f} — ') + '%{text}<extra>Event</extra>',
        })
      }

      const layout = {
        title: 'Farm Availability (equal-weighted)',
        margin: { l: 60, r: 20, t: 40, b: 60 },
        paper_bgcolor: surface,
        plot_bgcolor: surface,
        font: { color: text },
        xaxis: { title: usingDates ? 'Time' : 'Env Hours', autorange: true, gridcolor: border, zerolinecolor: border, linecolor: border, tickcolor: border },
        yaxis: { title: 'Availability', autorange: true, gridcolor: border, zerolinecolor: border, linecolor: border, tickcolor: border },
      } as any
      const config = { responsive: true, displaylogo: false } as any
      await Plotly.newPlot(plotRef.current, traces as any, layout, config)
      if (!mounted) {
        await Plotly.purge(plotRef.current)
      }
    })()
    return () => { mounted = false }
  }, [envTimes, envDatetimes, farmAvail, events, plotEvents, themeMode])

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={plotEvents} onChange={e => setPlotEvents(e.target.checked)} />
          Plot events (repair requests only)
        </label>
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

      <details style={{ marginTop: 16 }}>
        <summary style={{ fontWeight: 600 }}>Major events (filtered)</summary>
        <div style={{ marginTop: 8, overflow: 'auto', maxHeight: 320 }}>
          {events.length === 0 ? (
            <div>No events found for this run/time window.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Total major events loaded: {events.length}</div>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>System</th>
                    <th>Action</th>
                    <th>Reason</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i}>
                      <td>{e.time.toISOString().replace('T', ' ').slice(0, 16)}</td>
                      <td>{e.system}</td>
                      <td>{e.action}</td>
                      <td>{e.reason}</td>
                      <td>{e.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
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
