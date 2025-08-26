import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import SimulationControls from '../components/SimulationControls'
import PageWithLibrary from '../components/PageWithLibrary'
import { useApiContext } from '../context/ApiContext'
import ResizeWrapper from '../components/ResizeWrapper'
import FileSelector from '../components/FileSelector'
import SelectedFileInfo from '../components/SelectedFileInfo'
import ResultsSummary from '../components/ResultsSummary'
import OrbitResultsSummary from '../components/OrbitResultsSummary'
import { useToasts } from '../hooks/useToasts'
import { useOrbitSimulation } from '../hooks/useOrbitSimulation'
 

export default function RunSimulation() {
  const {
    apiBaseUrl,
    sessionId,
    // Shared state
    libraryFiles,
    selectedFile, setSelectedFile,
    configData,
    runSimulation,
    getConfig,
    fetchLibraryFiles,
    clearClientTemp,
    saveLibrary,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    readFile,
    setResults,
    setLibraryFiles,
    progress,
  } = useApiContext()

  const { info, success, warning, error, simulation, tempSweep } = useToasts()

  // Engine selection: WOMBAT (default) or ORBIT
  const [engine, setEngine] = useState<'wombat' | 'orbit'>('wombat')

  // Build requireSession wrapper for the ORBIT hook
  const requireSession = useCallback((): string => {
    if (!sessionId) throw new Error('No session')
    return sessionId
  }, [sessionId])

  // Use shared ORBIT hook for async trigger+poll with worker fallback
  const { runOrbitSimulation, progress: orbitProgress } = useOrbitSimulation({
    apiBaseUrl,
    requireSession,
    setResults,
    setLibraryFiles,
    fetchLibraryFiles,
  })

  // Track latest libraryFiles in a ref so async callbacks see fresh data
  const libFilesRef = useRef(libraryFiles)
  useEffect(() => { libFilesRef.current = libraryFiles }, [libraryFiles])

  // ORBIT config selection (files under project/config/*.yaml)
  const [orbitConfig, setOrbitConfig] = useState<string>('')
  const orbitConfigOptions = (libraryFiles?.yaml_files || []).filter(f => f.replace(/\\/g, '/').toLowerCase().startsWith('project/config/') )
  useEffect(() => {
    if (!orbitConfig && orbitConfigOptions.length > 0) {
      const preferred = orbitConfigOptions.find(f => f.toLowerCase().endsWith('/base.yaml') || f.toLowerCase() === 'config/base.yaml')
      setOrbitConfig(preferred || orbitConfigOptions[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryFiles])

  // Helper: select and read most recent results/<DATE>/summary.yaml
  const openMostRecentSummary = (): boolean => {
    const yamlList = libFilesRef.current?.yaml_files ?? []
    const entries = yamlList.map(orig => ({ orig, norm: orig.replace(/\\/g, '/') }))
    const summaries = entries.filter(e => e.norm.startsWith('results/') && e.norm.endsWith('/summary.yaml'))
    if (summaries.length === 0) return false
    summaries.sort((a, b) => {
      const ad = a.norm.slice('results/'.length, a.norm.length - '/summary.yaml'.length)
      const bd = b.norm.slice('results/'.length, b.norm.length - '/summary.yaml'.length)
      return bd.localeCompare(ad)
    })
    const pickedOrig = summaries[0].orig
    setSelectedFile(pickedOrig)
    readFile(pickedOrig, false).catch(() => { })
    return true
  }

  // Ensure the library file list is populated when arriving on this page
  useEffect(() => {
    if (!libraryFiles) {
      fetchLibraryFiles().catch(() => { })
    }
  }, [libraryFiles, fetchLibraryFiles])

  // Run WOMBAT (existing)
  const handleRunWombat = () => {
    const p = runSimulation()
    simulation(p)
    // optionally refresh files after completion (route already returns files)
    p.finally(() => {
      // Refresh files after run, then open most recent results/<DATE>/summary.yaml
      fetchLibraryFiles()
        .catch(() => { })
        .finally(() => {
          // Retry a few times to avoid race with async state updates
          const tryOpen = (attempt = 0) => {
            const ok = openMostRecentSummary()
            if (ok) {
              success('Opened latest results summary')
              return
            }
            if (attempt >= 10) {
              warning('Results summary not found yet')
              return
            }
            setTimeout(() => tryOpen(attempt + 1), 300)
          }
          tryOpen(0)
        })
    })
  }

  // Unified Run button based on selected engine
  const handleRun = () => {
    if (engine === 'orbit') return runOrbitSimulation(orbitConfig || undefined)
    return handleRunWombat()
  }

  const handleGetConfig = () => {
    info('Fetching base configuration…')
    getConfig().then(() => success('Configuration loaded')).catch(() => error('Failed to load configuration'))
  }
  const handleClearTemp = () => {
    tempSweep(clearClientTemp().then(ok => (ok ? 1 : 0)))
  }
  const handleGetLibraryFiles = () => {
    info('Refreshing files…')
    fetchLibraryFiles().then(() => success('Files refreshed')).catch(() => error('Failed to refresh files'))
  }
  const handleSaveLibrary = () => {
    const name = window.prompt('Enter a project name to save the current library:', selectedSavedLibrary || '')?.trim()
    if (!name) return
    info('Saving project…')
    saveLibrary(name).then(() => success('Project saved')).catch(() => error('Failed to save project'))
    setSelectedSavedLibrary(name)
  }

  // Sidebar handlers
  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath)
    const lf = filePath.toLowerCase()
    const isHtml = lf.endsWith('.html')
    const isPng = lf.endsWith('.png')
    readFile(filePath, isHtml || isPng).catch(() => { })
  }

  const handleDownloadFile = (_filePath: string) => {
    // Optional: download not needed on Run page
  }

  // Show progress from the selected engine
  const activeProgress = engine === 'orbit' ? orbitProgress : progress
  const pct = typeof activeProgress?.percent === 'number' ? Math.max(0, Math.min(100, activeProgress!.percent!)) : null
  const now = activeProgress?.now ?? 0
  const msg = activeProgress?.message || (pct === 100 ? 'finished' : 'idle')
  const isActive = pct != null && pct > 0 && pct < 100

  return (
    <PageWithLibrary
      title="Run Simulation"
      projectPlacement="sidebar"
      projectActions={null}
      sidebar={(
        <>
          <details open>
            <summary>Files</summary>
            <div className="panel-body">
              <FileSelector
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                libraryFiles={{ yaml_files: libraryFiles?.yaml_files ?? [], csv_files: [], html_files: [], png_files: [], total_files: (libraryFiles?.yaml_files?.length ?? 0) }}
                projectName={selectedSavedLibrary || undefined}
                onDownloadFile={handleDownloadFile}
                defaultExpandFolders={['results']}
                showActions={false}
              />
              <SelectedFileInfo selectedFile={selectedFile} />
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-app btn-secondary"
                  onClick={() => { info('Refreshing files…'); fetchLibraryFiles().then(() => success('Files refreshed')).catch(() => error('Failed to refresh files')) }}
                >Refresh Files</button>
              </div>
            </div>
          </details>
        </>
      )}
    >
      <div className="app-container-slim app-full">
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Engine</span>
              <select value={engine} onChange={e => setEngine(e.target.value as any)}>
                <option value="wombat">WOMBAT</option>
                <option value="orbit">ORBIT</option>
              </select>
            </label>
            {engine === 'orbit' && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Config</span>
                <select value={orbitConfig} onChange={e => setOrbitConfig(e.target.value)}>
                  {orbitConfigOptions.length === 0 && <option value="">No config files found under config/</option>}
                  {orbitConfigOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        <SimulationControls
          onRun={handleRun}
          onGetConfig={handleGetConfig}
          onClearTemp={handleClearTemp}
          onGetLibraryFiles={handleGetLibraryFiles}
          onSaveLibrary={handleSaveLibrary}
        />
        <ResizeWrapper minWidth={260} maxWidth={1200} lsKey="runpage.testwidth" defaultWidth={1000} collapsible={true} defaultCollapsed={false} disableBelow={768}>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header">Progress</div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label="Progress">
                    <div className={`progress-bar${isActive ? ' is-animating' : ''}`} style={{ width: pct == null ? '0%' : `${pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                    <span>{pct == null ? '—' : `${pct.toFixed(1)}%`}</span>
                    <span>now: {now.toFixed(1)}</span>
                  </div>
                </div>
                <div style={{ minWidth: 120, fontSize: 12 }}>
                  <span>{msg}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header">Results Summary</div>
            <div className="card-body">
              {(() => {
                const isOrbit = !!(configData && typeof configData === 'object' && (configData as any).highlights && (configData as any).highlights.engine === 'ORBIT')
                const sf = (selectedFile || '').toLowerCase()
                const isOrbitFile = sf.endsWith('/orbit_summary.yaml') || sf.endsWith('\\orbit_summary.yaml') || sf === 'orbit_summary.yaml'
                return (isOrbit || isOrbitFile)
                  ? <OrbitResultsSummary data={configData} />
                  : <ResultsSummary data={configData} />
              })()}
            </div>
          </div>
          <Suspense fallback={null}>
            {/* Room for future: live logs, metrics preview, etc. */}
          </Suspense>
        </ResizeWrapper>
      </div>
    </PageWithLibrary>
  )
}
