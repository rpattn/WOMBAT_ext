import { useEffect, useMemo, useState } from 'react'
import { useApiContext } from '../context/ApiContext'
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

  const yamlCandidates = useMemo(() => {
    if (!files?.yaml_files?.length) return []
    const re = /results[\\/]/i
    return files.yaml_files.filter(p => re.test(p))
  }, [files])

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
    <div className="app-container" style={{ gap: 12 }}>
      <h2>Results Comparison</h2>
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
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280 }}>
          <h3>Available Summaries</h3>
          {!files && <div>Loading files…</div>}
          {files && yamlCandidates.length === 0 && <div>No YAML summaries found.</div>}
          {files && yamlCandidates.length > 0 && (
            <ul style={{ maxHeight: 240, overflow: 'auto', paddingLeft: 16 }}>
              {yamlCandidates.map(p => (
                <li key={p}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedSummaries.includes(p)}
                      onChange={() => toggleSummary(p)}
                    />
                    <span title={p}>{p}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={loadSelected} disabled={selectedSummaries.length === 0}>Load Selected</button>
            <button onClick={() => { setSelectedSummaries([]); setSummaries([]); }}>Clear</button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 320 }}>
          <h3>Metric Picker</h3>
          <input
            value={metricText}
            onChange={e => setMetricText(e.target.value)}
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
