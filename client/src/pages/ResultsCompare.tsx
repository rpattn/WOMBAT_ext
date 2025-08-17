import { useEffect, useMemo, useState } from 'react'
import { useApiContext } from '../context/ApiContext'
import FileSelector from '../components/FileSelector'
import SavedLibrariesDropdown from '../components/SavedLibrariesDropdown'
import { listFiles, readFile, type FileList } from '../api'
import { normalizeForPlotly, parseSummaryYaml } from '../utils/results'

export default function ResultsCompare() {
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

  const requireSession = () => {
    if (!sessionId) throw new Error('No session')
    return sessionId
  }

  const [files, setFiles] = useState<FileList | null>(null)
  const [selectedSummaries, setSelectedSummaries] = useState<string[]>([])
  const [summaries, setSummaries] = useState<{ run: string; data: any }[]>([])
  const [metricText, setMetricText] = useState<string>('energy_mwh,total_cost_usd,downtime_hours')

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

  // File selection handled via FileSelector; no need to pre-filter here

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

  // Only show YAML files in the FileSelector on this page
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

  const loadSelected = async () => {
    const loaded: { run: string; data: any }[] = []
    for (const p of selectedSummaries) {
      const rf = await readFile(apiBaseUrl, requireSession, p, false)
      const text = typeof rf?.data === 'string' ? rf?.data : (rf?.data ? JSON.stringify(rf.data) : '')
      const obj = await parseSummaryYaml(text)
      loaded.push({ run: p.split('/').pop() || p, data: obj })
    }
    setSummaries(loaded)
  }

  const metricKeys = useMemo(() => metricText.split(',').map(s => s.trim()).filter(Boolean), [metricText])
  const normalized = useMemo(() => normalizeForPlotly({ summaries, metricKeys }), [summaries, metricKeys])

  return (
    <div className="app-container app-full" style={{ gap: 12 }}>
      <h2>Results Comparison</h2>
      <div className="section" style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-8)',
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
      <div className="row stack-sm" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 320, flex: '0 0 380px' }} className="panel">
          <h3 className="panel-title">Browse Files</h3>
          <div className="panel-body">
            <FileSelector
              projectName={selectedSavedLibrary || 'Library Files'}
              libraryFiles={resultsYamlOnlyFiles}
              selectedFile={undefined}
              selectedFiles={selectedSummaries}
              onFileSelect={(path: string) => {
                const isYaml = /\.(ya?ml)$/i.test(path)
                const inResults = /results[\\/]/i.test(path)
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
        </div>

        <div style={{ flex: 1, minWidth: 320 }}>
          <h3>Metric Picker</h3>
          <input
            value={metricText}
            onChange={e => setMetricText(e.target.value)}
            className="csv-filter"
            style={{ width: '100%' }}
            placeholder="Comma-separated metrics (e.g., energy_mwh,total_cost_usd)"
          />

          <h3 style={{ marginTop: 16 }}>Preview Table</h3>
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
      </div>

      {/* Plotly area placeholder; traces produced by normalizeForPlotly */}
      <div style={{ marginTop: 16 }}>
        <details>
          <summary>Plot Data (for debugging)</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(normalized.series, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}
