import { Suspense, useEffect, useRef } from 'react'
import SimulationControls from '../components/SimulationControls'
import PageWithLibrary from '../components/PageWithLibrary'
import { useApiContext } from '../context/ApiContext'
import ResizeWrapper from '../components/ResizeWrapper'
import FileSelector from '../components/FileSelector'
import SelectedFileInfo from '../components/SelectedFileInfo'
import ResultsSummary from '../components/ResultsSummary'
import { useToasts } from '../hooks/useToasts'
 

export default function RunSimulation() {
  const {
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
    progress,
  } = useApiContext()

  const { info, success, warning, error, simulation, tempSweep } = useToasts()

  // Track latest libraryFiles in a ref so async callbacks see fresh data
  const libFilesRef = useRef(libraryFiles)
  useEffect(() => { libFilesRef.current = libraryFiles }, [libraryFiles])

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

  const handleRun = () => {
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

  const pct = typeof progress?.percent === 'number' ? Math.max(0, Math.min(100, progress!.percent!)) : null
  const now = progress?.now ?? 0
  const msg = progress?.message || (pct === 100 ? 'finished' : 'idle')

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
        <SimulationControls
          onRun={handleRun}
          onGetConfig={handleGetConfig}
          onClearTemp={handleClearTemp}
          onGetLibraryFiles={handleGetLibraryFiles}
          onSaveLibrary={handleSaveLibrary}
        />
        <ResizeWrapper minWidth={260} maxWidth={1200} lsKey="runpage.testwidth" defaultWidth={1000} collapsible={true} defaultCollapsed={false}>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header">Progress</div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, background: '#eee', borderRadius: 7, overflow: 'hidden' }} aria-label="progress">
                    <div
                      style={{
                        width: pct == null ? '0%' : `${pct}%`,
                        height: '100%',
                        background: '#3b82f6',
                        transition: 'width 200ms ease',
                      }}
                    />
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
              <ResultsSummary data={configData} />
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
