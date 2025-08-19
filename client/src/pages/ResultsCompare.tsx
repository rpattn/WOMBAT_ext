import { useEffect, useMemo, useRef, useState } from 'react'
import { useApiContext } from '../context/ApiContext'
import FileSelector from '../components/FileSelector'
import { listFiles, readFile, type FileList } from '../api'
import { normalizeForPlotly, parseSummaryYaml } from '../utils/results'
import PageWithLibrary from '../components/PageWithLibrary'

export default function ResultsCompare() {
  const {
    apiBaseUrl,
    sessionId,
    initSession,
    libraryFiles,
    selectedSavedLibrary,
  } = useApiContext()

  const requireSession = () => {
    if (!sessionId) throw new Error('No session')
    return sessionId
  }

  const [files, setFiles] = useState<FileList | null>(null)
  const [selectedSummaries, setSelectedSummaries] = useState<string[]>([])
  const [summaries, setSummaries] = useState<{ run: string; data: any }[]>([])
  // Default to useful nested metrics present in summary YAMLs
  const [metricText, setMetricText] = useState<string>([
    'stats.maintenance.average_requests_per_month',
  ].join(','))
  // Percent difference disabled; plotting raw values

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

  // Clear current selections when project changes
  useEffect(() => {
    setSelectedSummaries([])
    setSummaries([])
  }, [selectedSavedLibrary])

  // Only show files that live under the results directory
  const resultsOnlyFiles = useMemo(() => {
    if (!files) return undefined
    const re = /^(?:results[\\/])/i
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

  // Only show YAML files under results in the FileSelector on this page
  const resultsYamlOnlyFiles = useMemo(() => {
    if (!resultsOnlyFiles) return undefined
    return {
      yaml_files: resultsOnlyFiles.yaml_files || [],
      csv_files: [],
      html_files: [],
      png_files: [],
      total_files: undefined,
    }
  }, [resultsOnlyFiles])

  const toggleSummary = (path: string) => {
    setSelectedSummaries(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
  }

  async function loadSelected() {
    const paths = selectedSummaries.filter(p => p.endsWith('.yml') || p.endsWith('.yaml'))
    if (paths.length === 0) return
    const loaded: { run: string; data: any }[] = []
    for (const p of paths) {
      const rf = await readFile(apiBaseUrl, requireSession, p, true)
      if (!rf) continue
      const text = String(rf.data ?? '')
      const obj = await parseSummaryYaml(text)
      const normalizedPath = String(p).replace(/\\/g, '/')
      const parts = normalizedPath.split('/')
      const fileBase = parts.pop() || normalizedPath
      const folder = parts.pop() || ''
      const baseRun = (obj && typeof obj === 'object' && (obj as any).name)
        ? String((obj as any).name)
        : fileBase
      const runName = folder ? `${baseRun} (${folder})` : baseRun
      loaded.push({ run: runName, data: obj })
    }
    setSummaries(loaded)
  }

  const metricKeys = useMemo(() => metricText.split(',').map(s => s.trim()).filter(Boolean), [metricText])
  const normalized = useMemo(() => normalizeForPlotly({
    summaries,
    metricKeys,
    normalization: 'none',
    percentDiff: { enabled: false },
  }), [summaries, metricKeys])

  // Discover numeric metric keys from loaded summaries (dot paths)
  const discoveredMetricKeys = useMemo(() => {
    const keys = new Set<string>()
    const visit = (obj: any, prefix: string) => {
      if (!obj || typeof obj !== 'object') return
      for (const k of Object.keys(obj)) {
        const path = prefix ? `${prefix}.${k}` : k
        const v: any = (obj as any)[k]
        if (v !== null && typeof v === 'object') {
          visit(v, path)
        } else if (typeof v === 'number') {
          keys.add(path)
        }
      }
    }
    for (const s of summaries) visit(s.data, '')
    return Array.from(keys).sort()
  }, [summaries])

  // Metric filter/search UI state
  const [metricFilter, setMetricFilter] = useState('')
  const filteredDiscovered = useMemo(() => {
    const q = metricFilter.trim().toLowerCase()
    if (!q) return discoveredMetricKeys
    return discoveredMetricKeys.filter(k => k.toLowerCase().includes(q))
  }, [metricFilter, discoveredMetricKeys])

  // Selected metric set derived from metricText
  const selectedSet = useMemo(() => new Set(metricKeys), [metricKeys])
  const toggleMetric = (k: string) => {
    const set = new Set(selectedSet)
    if (set.has(k)) set.delete(k)
    else set.add(k)
    setMetricText(Array.from(set).join(','))
  }

  // Plotly chart
  const plotRef = useRef<HTMLDivElement | null>(null)
  // Track theme (light/dark) to restyle Plotly when it changes
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
      if (normalized.series.length === 0) {
        // Clear any previous plot
        try {
          const Plotly = (await import('plotly.js-dist-min')).default
          await Plotly.purge(plotRef.current)
        } catch {}
        return
      }
      const Plotly = (await import('plotly.js-dist-min')).default
      // Resolve theme-aware colors from CSS variables (fallbacks included)
      const root = getComputedStyle(document.documentElement)
      const surface = (root.getPropertyValue('--color-surface') || '').trim() || (themeMode === 'dark' ? '#111827' : '#ffffff')
      const text = (root.getPropertyValue('--color-text') || '').trim() || (themeMode === 'dark' ? '#E5E7EB' : '#111827')
      const border = (root.getPropertyValue('--color-border') || '').trim() || (themeMode === 'dark' ? '#374151' : '#E5E7EB')
      // Prepare traces with value labels on top of bars
      const formatVal = (v: any) => {
        const n = Number(v)
        if (!Number.isFinite(n)) return String(v)
        const abs = Math.abs(n)
        if (abs === 0) return '0'
        if (abs < 1) return n.toPrecision(3)
        if (abs < 1000) return n.toFixed(2)
        return Math.round(n).toLocaleString()
      }
      const traces = (normalized.series as any[]).map(t => ({
        ...t,
        text: (t.y || []).map((v: any) => formatVal(v)),
        textposition: 'outside',
        textfont: { color: text },
        hovertemplate: '%{x}: %{y}<extra>%{fullData.name}</extra>',
      }))

      const yTitle = metricKeys.length === 1
        ? ((metricKeys[0].split('.').pop() || 'Value'))
        : 'Value'

      const layout = {
        title: 'Metrics Comparison',
        barmode: 'group',
        margin: { l: 60, r: 20, t: 40, b: 60 },
        paper_bgcolor: surface,
        plot_bgcolor: surface,
        font: { color: text },
        xaxis: { title: 'Metric', gridcolor: border, zerolinecolor: border, linecolor: border, tickcolor: border },
        yaxis: { title: yTitle, gridcolor: border, zerolinecolor: border, linecolor: border, tickcolor: border },
        uniformtext: { minsize: 8, mode: 'hide' },
        bargap: 0.15,
        bargroupgap: 0.1,
      } as any
      const config = { responsive: true, displaylogo: false } as any
      await Plotly.newPlot(plotRef.current, traces as any, layout, config)
      if (!mounted) {
        await Plotly.purge(plotRef.current)
      }
    })()
    return () => { mounted = false }
  }, [normalized, themeMode])

  return (
    <PageWithLibrary
      title="Results Comparison"
      sidebar={(
        <>
          <h3 className="panel-title">Browse Files</h3>
          <div className="panel-body">
            <FileSelector
              projectName={selectedSavedLibrary || 'Library Files'}
              libraryFiles={resultsYamlOnlyFiles}
              selectedFile={undefined}
              selectedFiles={selectedSummaries}
              onFileSelect={(path: string) => {
                const isYaml = /\.(ya?ml)$/i.test(path)
                const inResults = /^(?:results[\\/])/i.test(path)
                if (isYaml && inResults) {
                  toggleSummary(path)
                }
              }}
              showActions={false}
              defaultExpandFolders={defaultExpand}
            />
            <div className="controls" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={loadSelected} disabled={selectedSummaries.length === 0}>Load Selected</button>
              <button className="btn btn-secondary" onClick={() => { setSelectedSummaries([]); setSummaries([]); }}>Clear</button>
              <span style={{ marginLeft: 'auto' }}>{selectedSummaries.length} selected</span>
            </div>
          </div>
        </>
      )}
    >
      <details style={{ marginTop: 8 }}>
        <summary style={{ fontWeight: 600 }}>Preview Table</summary>
        <div style={{ marginTop: 8 }}>
          {normalized.table.rows.length === 0 ? (
            <div>Select summaries and click Load Selected.</div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 320 }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    {normalized.table.columns.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {normalized.table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => <td key={j}>{String(cell)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* Plotly area placeholder; traces produced by normalizeForPlotly */}
      <details style={{ marginTop: 16 }} open>
        <summary style={{ fontWeight: 600 }}>Metrics</summary>
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontWeight: 600 }}>Metric keys (advanced)</summary>
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Metric keys (comma-separated)</label>
            <input
              value={metricText}
              onChange={e => setMetricText(e.target.value)}
              className="csv-filter"
              style={{ width: '100%' }}
              placeholder="Comma-separated metrics (e.g., energy_mwh,total_cost_usd)"
            />
          </div>
        </details>
        <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Filter metrics..."
            value={metricFilter}
            onChange={e => setMetricFilter(e.target.value)}
            className="csv-filter"
            style={{ flex: '0 0 280px' }}
          />
          <small>{filteredDiscovered.length} metrics found</small>
        </div>
        <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--color-border)', padding: 8, borderRadius: 4, marginTop: 8 }}>
          {filteredDiscovered.map(k => (
            <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12, marginBottom: 6 }}>
              <input type="checkbox" checked={selectedSet.has(k)} onChange={() => toggleMetric(k)} />
              <span>{k}</span>
            </label>
          ))}
        </div>
      </details>

      <h3 style={{ marginTop: 16 }}>Chart</h3>
      <div ref={plotRef} style={{ width: '100%', height: 420, background: 'var(--color-surface)' }} />
      <details style={{ marginTop: 8 }}>
        <summary>Plot Data (debug)</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(normalized.series, null, 2)}</pre>
      </details>
    </PageWithLibrary>
  )
}
