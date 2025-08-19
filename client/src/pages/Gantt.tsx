import { useEffect, useMemo, useRef, useState } from 'react'
import { useApiContext } from '../context/ApiContext'
import FileSelector from '../components/FileSelector'
import SavedLibrariesDropdown from '../components/SavedLibrariesDropdown'
import { listFiles, readFile, type FileList } from '../api'
import { parseCsvEvents, type EventRow } from '../utils/results'

// Client-side Gantt page using Plotly (plotly.js-dist-min). Inspired by server utilities in
// `wombat/utilities/gantt.py` and examples in `examples/dinwoodie_gantt_chart_plotly.py`.
// We build a simple CTV work timeline: filter events for maintenance/repair actions with duration > 0
// and plot segments by vessel over time.

export default function Gantt() {
  const {
    apiBaseUrl,
    sessionId,
    initSession,
    libraryFiles,
    savedLibraries,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    loadSaved,
  } = useApiContext()

  const [files, setFiles] = useState<FileList | null>(null)
  const [selectedCsv, setSelectedCsv] = useState<string>('')
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [status, setStatus] = useState<string>('')

  const plotRef = useRef<HTMLDivElement | null>(null)
  const [themeKey, setThemeKey] = useState(0) // bump to trigger re-render on theme change
  const resultsOnlyFiles = useMemo(() => {
    if (!files) return undefined
    const re = /results[\\/]/i
    return {
      yaml_files: (files.yaml_files || []).filter(p => re.test(p)),
      csv_files: (files.csv_files || []).filter(p => re.test(p)),
      html_files: (files as any).html_files ? (files as any).html_files.filter((p: string) => re.test(p)) : undefined,
      png_files: (files as any).png_files ? (files as any).png_files.filter((p: string) => re.test(p)) : undefined,
      total_files: undefined,
    }
  }, [files])

  const defaultExpand = useMemo(() => {
    const base = ['results'] as string[]
    const lists = resultsOnlyFiles ? [
      resultsOnlyFiles.yaml_files || [],
      resultsOnlyFiles.csv_files || [],
      (resultsOnlyFiles as any).html_files || [],
      (resultsOnlyFiles as any).png_files || [],
    ] : []
    const all = ([] as string[]).concat(...lists)
    const subs = new Set<string>()
    for (const p of all) {
      const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean)
      if (parts[0] === 'results' && parts[1]) subs.add(parts[1])
    }
    const first = Array.from(subs).sort()[0]
    if (first) base.push(`results/${first}`)
    return base
  }, [resultsOnlyFiles])

  // Only show CSV files in the FileSelector on this page
  const resultsCsvOnlyFiles = useMemo(() => {
    if (!resultsOnlyFiles) return undefined
    return {
      yaml_files: [],
      csv_files: resultsOnlyFiles.csv_files || [],
      html_files: [],
      png_files: [],
      total_files: undefined,
    }
  }, [resultsOnlyFiles])

  const requireSession = () => {
    if (!sessionId) throw new Error('No session')
    return sessionId
  }

  useEffect(() => {
    ;(async () => {
      if (!sessionId) await initSession()
      try {
        const fl = await listFiles(apiBaseUrl, requireSession)
        setFiles(fl)
        const resultsPath = /results[\\/]/i
        const list = (fl?.csv_files ?? []).filter(p => resultsPath.test(p))
        if (list.length) {
          // Prefer an events csv in results directory if present
          const preferred = list.find(p => /results[\\/].+events/i.test(p)) || list[0]
          setSelectedCsv(preferred)
        } else {
          setSelectedCsv('')
        }
      } catch (e) {
        setFiles(null)
      }
    })()
  }, [apiBaseUrl, sessionId, initSession, selectedSavedLibrary, libraryFiles])

  // Clear current selection/data when project changes
  useEffect(() => {
    setSelectedCsv('')
    setEvents(null)
    setStatus('')
  }, [selectedSavedLibrary])

  async function loadCsv() {
    if (!selectedCsv) return
    setStatus('Loading CSV…')
    try {
      const rf = await readFile(apiBaseUrl, requireSession, selectedCsv, false)
      const text = typeof rf?.data === 'string' ? rf.data : (rf?.data ? JSON.stringify(rf.data) : '')
      const rows = await parseCsvEvents(text)
      setEvents(rows)
      setStatus(rows.length ? `Loaded ${rows.length} rows` : 'No rows')
    } catch (e) {
      setEvents(null)
      setStatus('Failed to load CSV')
    }
  }

  const segments = useMemo(() => buildCtvSegments(events || []), [events])

  // Detect theme changes (prefers-color-scheme and html class toggles) and trigger re-render
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => setThemeKey(k => k + 1)
    try { mql.addEventListener('change', onScheme) } catch { /* Safari */ mql.addListener(onScheme) }

    const mo = new MutationObserver(() => setThemeKey(k => k + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      try { mql.removeEventListener('change', onScheme) } catch { mql.removeListener(onScheme) }
      mo.disconnect()
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Do not import/initialize Plotly when there is nothing to render (e.g., in tests with no data)
      if (!plotRef.current || segments.length === 0) return
      const Plotly = (await import('plotly.js-dist-min')).default
      const plotDiv = plotRef.current

      const { traces, layout } = buildPlotlyTimeline(segments)
      // Apply theme-aware colors from CSS variables
      const tokens = getThemeTokens()
      ;(layout as any).paper_bgcolor = tokens.bg
      ;(layout as any).plot_bgcolor = tokens.surface
      ;(layout as any).font = { color: tokens.text }
      ;(layout as any).xaxis = {
        ...(layout as any).xaxis,
        gridcolor: tokens.border,
        linecolor: tokens.border,
        tickcolor: tokens.border,
      }
      ;(layout as any).yaxis = {
        ...(layout as any).yaxis,
        gridcolor: tokens.border,
        linecolor: tokens.border,
        tickcolor: tokens.border,
      }
      const config = { responsive: true, displaylogo: false } as any
      await Plotly.newPlot(plotDiv, traces as any, layout as any, config)
      if (!mounted) {
        await Plotly.purge(plotDiv)
      }
    })()
    return () => { mounted = false }
  }, [segments, themeKey])

  return (
    <div className="app-container app-full" style={{ gap: 12 }}>
      <h2>Client Gantt (CTV Work)</h2>
      <div className="section" style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-8)'
      }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Project</h3>
        <div className="saved-libs" style={{ maxWidth: 520 }}>
          <SavedLibrariesDropdown
            libraries={savedLibraries}
            value={selectedSavedLibrary}
            onChange={(val: string) => {
              setSelectedSavedLibrary(val)
              try { window.localStorage.setItem('lastSavedLibraryName', val || '') } catch {}
              if (val) { loadSaved(val).catch(() => {}) }
            }}
          />
        </div>
      </div>
      <div className="panel">
        <h3 className="panel-title">CSV File</h3>
        <div className="panel-body">
          <FileSelector
            projectName={selectedSavedLibrary || 'Library Files'}
            libraryFiles={resultsCsvOnlyFiles}
            selectedFile={selectedCsv || undefined}
            onFileSelect={(path: string) => {
              const isCsv = /\.csv$/i.test(path)
              const inResults = /results[\\/]/i.test(path)
              if (isCsv && inResults) {
                setSelectedCsv(path)
              }
            }}
            showActions={false}
            defaultExpandFolders={defaultExpand}
          />
          <div className="controls" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={loadCsv} disabled={!selectedCsv}>Load</button>
            <div style={{ marginLeft: 'auto' }}>{status}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div ref={plotRef} style={{ width: '100%', height: 500 }} />
      </div>

      <details style={{ marginTop: 12 }}>
        <summary>Debug: Segments ({segments.length})</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(segments.slice(0, 50), null, 2)}</pre>
      </details>
    </div>
  )
}

// ---------- helpers: minimal, resilient client-side equivalents ----------

export type Segment = {
  vessel: string
  start: string // ISO string
  finish: string // ISO string
  duration_hours: number
  request_id?: string
  system_id?: string | number
  part_name?: string
}

function buildCtvSegments(rows: EventRow[]): Segment[] {
  if (!rows || rows.length === 0) return []
  const out: Segment[] = []
  for (const r of rows) {
    const action = String(r.action || r.Action || '').toLowerCase()
    if (action !== 'maintenance' && action !== 'repair') continue

    const dur = Number(r.duration ?? r.Duration ?? 0)
    if (!Number.isFinite(dur) || dur <= 0) continue

    const agent = String(r.agent ?? r.Agent ?? '').trim()
    if (!agent) continue // require a vessel/agent name

    const start = new Date(String(r.env_datetime ?? r.datetime ?? r.DateTime ?? '')).toISOString()
    const finish = new Date(new Date(start).getTime() + dur * 3600_000).toISOString()
    out.push({
      vessel: agent,
      start,
      finish,
      duration_hours: dur,
      request_id: r.request_id?.toString?.() ?? r.RequestID?.toString?.(),
      system_id: r.system_id ?? r.SystemID,
      part_name: r.part_name ?? r.PartName,
    })
  }
  return out
}

function buildPlotlyTimeline(segments: Segment[]) {
  // Build a timeline-like chart using horizontal bars with base=start and x=duration (ms)
  const byVessel = new Map<string, Segment[]>()
  for (const s of segments) {
    if (!byVessel.has(s.vessel)) byVessel.set(s.vessel, [])
    byVessel.get(s.vessel)!.push(s)
  }

  // Keep y order stable by vessel name
  const vessels = Array.from(byVessel.keys()).sort()

  const traces = [] as any[]
  for (const vessel of vessels) {
    const segs = byVessel.get(vessel)!.sort((a, b) => +new Date(a.start) - +new Date(b.start))
    const x = segs.map(s => (new Date(s.finish).getTime() - new Date(s.start).getTime()))
    const base = segs.map(s => new Date(s.start))
    const y = segs.map(() => vessel)
    const text = segs.map(s => `${s.part_name ?? ''}`)
    const hover = segs.map(s =>
      `Vessel: ${vessel}<br>Start: ${s.start}<br>Finish: ${s.finish}` +
      `<br>Duration (h): ${s.duration_hours.toFixed(2)}` +
      (s.part_name ? `<br>Part: ${s.part_name}` : '') +
      (s.system_id != null ? `<br>System: ${s.system_id}` : '') +
      (s.request_id ? `<br>Request: ${s.request_id}` : '')
    )

    traces.push({
      type: 'bar',
      orientation: 'h',
      x, // durations (ms default; dates convert automatically)
      base, // start times
      y,
      name: vessel,
      hovertext: hover,
      hoverinfo: 'text',
      text,
      marker: { opacity: 0.9 },
    })
  }

  const layout = {
    barmode: 'stack', // show as discrete bars per vessel row
    title: 'CTV Work Timeline by Vessel',
    xaxis: {
      title: 'Time',
      type: 'date',
    },
    yaxis: {
      title: '',
      categoryorder: 'array',
      categoryarray: vessels,
      automargin: true,
    },
    height: Math.max(400, 60 * Math.max(1, vessels.length)),
    margin: { l: 120, r: 30, t: 40, b: 40 },
  }

  return { traces, layout }
}

function getThemeTokens() {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const read = (name: string) => cs.getPropertyValue(name).trim() || undefined
  return {
    bg: read('--color-bg') || '#ffffff',
    surface: read('--color-surface') || '#f8fafc',
    text: read('--color-text') || '#111827',
    border: read('--color-border') || '#e5e7eb',
  }
}
