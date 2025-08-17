import { useEffect, useMemo, useRef, useState } from 'react'
import { useApiContext } from '../context/ApiContext'
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
        console.log(fl)
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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!plotRef.current) return
      const Plotly = (await import('plotly.js-dist-min')).default
      const plotDiv = plotRef.current

      const { traces, layout } = buildPlotlyTimeline(segments)
      const config = { responsive: true, displaylogo: false } as any
      await Plotly.newPlot(plotDiv, traces as any, layout as any, config)
      if (!mounted) {
        await Plotly.purge(plotDiv)
      }
    })()
    return () => { mounted = false }
  }, [segments])

  return (
    <div className="app-container" style={{ gap: 12 }}>
      <h2>Client Gantt (CTV Work)</h2>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ maxWidth: 480 }}>
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
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280 }}>
          <label style={{ display: 'block', fontWeight: 600 }}>CSV File</label>
          <select
            value={selectedCsv}
            onChange={e => setSelectedCsv(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">-- select a CSV --</option>
            {(files?.csv_files ?? []).filter(p => /results[\\/]/i.test(p)).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <button onClick={loadCsv} disabled={!selectedCsv}>Load</button>
        <div>{status}</div>
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
