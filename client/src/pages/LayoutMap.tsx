import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { useApiContext } from '../context/ApiContext'
import { listFiles, readFile } from '../api'
import FileSelector from '../components/FileSelector'

// Minimal Leaflet usage without react-leaflet to avoid extra deps
// Dynamically load Leaflet CSS to keep scope local to this page
function useLeafletCss() {
  useEffect(() => {
    const id = 'leaflet-css'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
    link.crossOrigin = ''
    document.head.appendChild(link)
    return () => { /* keep CSS cached */ }
  }, [])
}

export default function LayoutMap() {
  useLeafletCss()
  const { apiBaseUrl, sessionId, initSession, selectedSavedLibrary } = useApiContext()

  const [layoutPath, setLayoutPath] = useState<string>('')
  const [libraryFiles, setLibraryFiles] = useState<{ yaml_files: string[]; csv_files: string[]; html_files?: string[]; png_files?: string[]; total_files?: number } | undefined>(undefined)
  const [points, setPoints] = useState<Array<{ name: string; lat: number; lon: number }>>([])
  const [status, setStatus] = useState<string>('')

  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<any>(null) // L map instance
  const layerRef = useRef<any>(null)   // marker layer group

  const requireSession = () => {
    if (!sessionId) throw new Error('No session')
    return sessionId
  }

  useEffect(() => {
    ;(async () => {
      if (!sessionId) await initSession()
      try {
        const fl = await listFiles(apiBaseUrl, requireSession)
        // Only expose CSV files to the selector
        const csvOnly = { yaml_files: [], csv_files: fl?.csv_files ?? [], total_files: fl?.total_files }
        setLibraryFiles(csvOnly)
        const candidates = (csvOnly.csv_files ?? []).filter(p => /layout\.csv$/i.test(p))
        // Prefer canonical project\\plant\\layout.csv
        const preferred = candidates.find(p => /project[\\/]plant[\\/]layout\.csv$/i.test(p)) || candidates[0]
        setLayoutPath(preferred || '')
        if (preferred) {
          await loadLayout(preferred)
        }
      } catch {
        setLibraryFiles(undefined)
        setLayoutPath('')
      }
    })()
  }, [apiBaseUrl, sessionId, initSession, selectedSavedLibrary])

  // Clear on library change
  useEffect(() => {
    setLibraryFiles(undefined)
    setPoints([])
    setStatus('')
  }, [selectedSavedLibrary])

  async function loadLayout(pathOverride?: string) {
    const path = pathOverride ?? layoutPath
    if (!path) return
    setStatus('Loading layout…')
    try {
      const rf = await readFile(apiBaseUrl, requireSession, path, false)
      const text = typeof rf?.data === 'string' ? rf.data : (rf?.data ? JSON.stringify(rf.data) : '')
      const rows = Papa.parse(text, { header: true, dynamicTyping: true }).data as any[]
      const pts: Array<{ name: string; lat: number; lon: number }> = []
      for (const r of rows) {
        if (!r) continue
        const name = pickFirst(r, ['name','Name','turbine','Turbine','id','ID','label','Label'])
        const lat = num(pickFirst(r, ['latitude','Latitude','lat','LAT','Lat']))
        const lon = num(pickFirst(r, ['longitude','Longitude','lon','LONG','Long','Lng','lng','long']))
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          pts.push({ name: String(name ?? ''), lat: Number(lat), lon: Number(lon) })
        }
      }
      setPoints(pts)
      setStatus(pts.length ? `Loaded ${pts.length} locations` : 'No valid coordinates found')
    } catch (e) {
      console.error(e)
      setPoints([])
      setStatus('Failed to load layout.csv')
    }
  }

  // Initialize and update the Leaflet map when points change
  useEffect(() => {
    ;(async () => {
      if (!mapRef.current) return
      if (!points.length) return
      // Lazy import Leaflet only when needed (avoids SSR/test issues)
      const L = (await import('leaflet')).default

      // Create map once
      if (!leafletRef.current) {
        leafletRef.current = L.map(mapRef.current, {
          center: [points[0].lat, points[0].lon],
          zoom: 10,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(leafletRef.current)
      }

      const map = leafletRef.current as any

      // Clear previous markers
      if (layerRef.current) {
        layerRef.current.clearLayers()
        map.removeLayer(layerRef.current)
      }
      layerRef.current = L.layerGroup().addTo(map)

      const bounds = L.latLngBounds([])
      for (const p of points) {
        const marker = L.marker([p.lat, p.lon])
        const label = p.name ? String(p.name) : `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`
        marker
          .addTo(layerRef.current)
          .bindTooltip(label, { direction: 'top', offset: [-14, -10] })
        bounds.extend([p.lat, p.lon] as any)
      }
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.1))
      }
    })()
    return () => { /* no-op */ }
  }, [points])


  return (
    <div className="app-container app-full" style={{ gap: 12 }}>
      <h2>Layout Map</h2>

      <div className="section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-8)' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Project</h3>
        {/* Reuse SavedLibrariesDropdown from Gantt context via Simulation Manager header, navigated here */}
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          Selected: {selectedSavedLibrary || '(working library)'}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Layout CSV</h3>
        <div className="panel-body" style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FileSelector
              libraryFiles={libraryFiles}
              selectedFile={layoutPath}
              onFileSelect={async (fp) => {
                if (!/\.csv$/i.test(fp)) return
                setLayoutPath(fp)
                await loadLayout(fp)
              }}
              showActions={false}
              defaultExpandFolders={["project", "project/plant"]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
            <div><strong>Selected:</strong> <code style={{ wordBreak: 'break-all' }}>{layoutPath || '(none)'}</code></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => loadLayout()} disabled={!layoutPath}>Load</button>
              <button className="btn" onClick={() => loadLayout()} disabled={!layoutPath}>Reload</button>
            </div>
            <div>{status}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div ref={mapRef} style={{ width: '100%', height: 520, border: '1px solid var(--color-border)', borderRadius: 6 }} />
      </div>

      <details style={{ marginTop: 12 }}>
        <summary>Debug: Points ({points.length})</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(points.slice(0, 50), null, 2)}</pre>
      </details>
    </div>
  )
}

function pickFirst(obj: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  return undefined
}

function num(v: any): number | undefined {
  const n = typeof v === 'string' ? Number(v.trim()) : Number(v)
  return Number.isFinite(n) ? n : undefined
}
