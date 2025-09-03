import { useEffect, useMemo, useState } from 'react'
import { useApiContext } from '../context/ApiContext'
import './WebSocketClient.css'

// Module-scoped guard to avoid double POST /api/session under React StrictMode (dev)
let __autoInitDone = false

export default function RestClient() {
  const api = useApiContext()
  const [baseUrl, setBaseUrl] = useState(api.apiBaseUrl)
  const [pendingPath, setPendingPath] = useState('project/config/base.yaml')
  const [pendingProjectName, setPendingProjectName] = useState('my_project')
  const [schemas, setSchemas] = useState<string[]>([])
  const [schemaName, setSchemaName] = useState<string>('configuration')
  const [schemaJson, setSchemaJson] = useState<string>('')

  useEffect(() => {
    // Keep local input in sync if context base changes
    setBaseUrl(api.apiBaseUrl)
  }, [api.apiBaseUrl])

  useEffect(() => {
    // Look in local storage for last used URL
    const saved = localStorage.getItem('wombat_ext_api_base_url')
    if (saved) {
      setBaseUrl(saved)
      api.setApiBaseUrl(saved)
    }

    // Auto-init a session and prefetch data (guarded for React StrictMode double-mount)
    if (__autoInitDone) return
    __autoInitDone = true
    let cancelled = false
    ;(async () => {
      if (!api.sessionId) {
        const id = await api.initSession()
        if (!id || cancelled) return
      }
      await api.fetchSavedLibraries().catch(() => {})
      await api.fetchLibraryFiles().catch(() => {})
      await api.getConfig().catch(() => {})
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sessionInfo = useMemo(() => api.sessionId ? `Session: ${api.sessionId.slice(0,8)}…` : 'No session', [api.sessionId])

  return (
    <div className="ws-container" style={{ margin: '5px' }}>
      <div className="card ws-card" style={{ margin: '5px' }}>
        <label className="ws-label">
          <span>Server REST API Base URL</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value)
              localStorage.setItem('wombat_ext_api_base_url', e.target.value)
            }}
            onBlur={() => api.setApiBaseUrl(baseUrl)}
            placeholder="http://127.0.0.1:8000/api"
            className="ws-input"
          />
        </label>

        <div className="ws-row" style={{ alignItems: 'center', gap: 8 }}>
          <button className="btn-app btn-success" onClick={api.initSession} disabled={!!api.sessionId}>Init Session</button>
          <button className="btn-app btn-danger" onClick={api.endSession} disabled={!api.sessionId}>End Session</button>
          <span style={{ opacity: 0.8 }}>{sessionInfo}</span>
        </div>

        <div className="ws-grid">
          <span>Common actions</span>
          <div className="ws-row">
            <button className="btn-app btn-primary" onClick={api.fetchLibraryFiles} disabled={!api.sessionId}>Refresh Files</button>
            <button className="btn-app btn-primary" onClick={api.fetchSavedLibraries}>Refresh Saved</button>
            <button className="btn-app btn-primary" onClick={api.getConfig} disabled={!api.sessionId}>Get Config</button>
            <button className="btn-app btn-primary" onClick={()=>{api.runSimulation(undefined)}} disabled={!api.sessionId}>Run Simulation</button>
            <button
              className="btn-app btn-secondary"
              onClick={async () => {
                try {
                  const count = await api.sweepTemp();
                  console.info(`Sweep Temp removed ${count} folder(s)`)
                } catch (e) {
                  console.warn('Sweep Temp failed', e)
                }
              }}
            >Sweep Temp</button>
            <button
              className="btn-app btn-secondary"
              onClick={async () => {
                try {
                  const count = await api.sweepTempAll();
                  console.info(`Sweep Temp All removed ${count} folder(s)`)
                } catch (e) {
                  console.warn('Sweep Temp All failed', e)
                }
              }}
            >Sweep Temp All</button>
          </div>
        </div>

        <div className="ws-grid">
          <span>Read file</span>
          <div className="ws-row">
            <input
              type="text"
              value={pendingPath}
              onChange={(e) => setPendingPath(e.target.value)}
              className="ws-input ws-grow"
              placeholder="project/config/base.yaml"
            />
            <button className="btn-app btn-primary" onClick={() => api.readFile(pendingPath, false)} disabled={!api.sessionId}>Read</button>
            <button className="btn-app btn-secondary" onClick={() => api.readFile(pendingPath, true)} disabled={!api.sessionId}>Read Raw</button>
          </div>
        </div>

        <div className="ws-grid">
          <span>Save Library</span>
          <div className="ws-row">
            <input
              type="text"
              value={pendingProjectName}
              onChange={(e) => setPendingProjectName(e.target.value)}
              className="ws-input ws-grow"
              placeholder="my_project"
            />
            <button className="btn-app btn-primary" onClick={() => api.saveLibrary(pendingProjectName)} disabled={!api.sessionId}>Save</button>
          </div>
        </div>

        <div className="ws-grid">
          <span>Schemas</span>
          <div className="ws-row" style={{ gap: 8 }}>
            <button
              className="btn-app btn-primary"
              onClick={async () => {
                const list = await api.listSchemas()
                setSchemas(list)
              }}
            >List Schemas</button>
            <select className="ws-input" value={schemaName} onChange={(e) => setSchemaName(e.target.value)}>
              {[schemaName, ...schemas.filter(s => s !== schemaName)].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              className="btn-app btn-secondary"
              onClick={async () => {
                try {
                  const sch = await api.getSchema(schemaName)
                  setSchemaJson(JSON.stringify(sch, null, 2))
                } catch (e:any) {
                  setSchemaJson(`Error: ${e?.message || String(e)}`)
                }
              }}
            >Get Schema</button>
          </div>
          <textarea
            className="ws-input"
            style={{ width: '100%', height: 200 }}
            readOnly
            value={schemaJson}
            placeholder="JSON Schema will appear here"
          />
        </div>
      </div>
    </div>
  )
}
