import { Suspense } from 'react'
import SimulationControls from '../components/SimulationControls'
import PageWithLibrary from '../components/PageWithLibrary'
import { useApiContext } from '../context/ApiContext'
import ResizeWrapper from '../components/ResizeWrapper'

export default function RunSimulation() {
  const {
    runSimulation,
    getConfig,
    fetchLibraryFiles,
    clearClientTemp,
    saveLibrary,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    progress,
  } = useApiContext()

  const handleRun = () => {
    const p = runSimulation()
    // optionally refresh files after completion (route already returns files)
    p.finally(() => { fetchLibraryFiles().catch(() => {}) })
  }

  const handleGetConfig = () => { getConfig().catch(() => {}) }
  const handleClearTemp = () => { clearClientTemp().catch(() => {}) }
  const handleGetLibraryFiles = () => { fetchLibraryFiles().catch(() => {}) }
  const handleSaveLibrary = () => {
    const name = window.prompt('Enter a project name to save the current library:', selectedSavedLibrary || '')?.trim()
    if (!name) return
    saveLibrary(name).catch(() => {})
    setSelectedSavedLibrary(name)
  }

  const pct = typeof progress?.percent === 'number' ? Math.max(0, Math.min(100, progress!.percent!)) : null
  const now = progress?.now ?? 0
  const msg = progress?.message || (pct === 100 ? 'finished' : 'idle')

  return (
    <PageWithLibrary
      title="Run Simulation"
      projectActions={null}
      sidebar={null}
    >
      <div className="app-container-slim app-full">
        <SimulationControls
          onRun={handleRun}
          onGetConfig={handleGetConfig}
          onClearTemp={handleClearTemp}
          onGetLibraryFiles={handleGetLibraryFiles}
          onSaveLibrary={handleSaveLibrary}
        />
        <ResizeWrapper minWidth={260} maxWidth={1200} lsKey="runpage.testwidth" defaultWidth={1000}>
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
                <div style={{ minWidth: 120, textAlign: 'right', fontSize: 12 }}>
                  <span>{msg}</span>
                </div>
              </div>
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
