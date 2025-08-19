import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { useApiContext } from '../context/ApiContext'
import { readFile } from '../api'
import FileSelector from '../components/FileSelector'
import PageWithLibrary from '../components/PageWithLibrary'

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
  const { apiBaseUrl, sessionId, initSession, selectedSavedLibrary, libraryFiles, fetchLibraryFiles } = useApiContext()

  const [layoutPath, setLayoutPath] = useState<string>('')
  const [points, setPoints] = useState<Array<{ name: string; lat: number; lon: number; stringId?: string }>>([])
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
      // Ask server for latest files for the active project
      await fetchLibraryFiles().catch(() => {})
    })()
  }, [apiBaseUrl, sessionId, initSession, selectedSavedLibrary, fetchLibraryFiles])

  // When libraryFiles update, select a default layout and optionally load it
  useEffect(() => {
    if (!libraryFiles) return
    const candidates = (libraryFiles.csv_files ?? []).filter(p => /layout\.csv$/i.test(p))
    const preferred = candidates.find(p => /project[\\\/]plant[\\\/]layout\.csv$/i.test(p)) || candidates[0]
    setLayoutPath(preferred || '')
    if (preferred) {
      // fire and forget; keep UI responsive
      loadLayout(preferred)
    } else {
      setStatus('')
    }
  }, [libraryFiles])

  // Clear on project change
  useEffect(() => {
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
      const pts: Array<{ name: string; lat: number; lon: number; stringId?: string }> = []
      for (const r of rows) {
        if (!r) continue
        const name = pickFirst(r, ['name','Name','turbine','Turbine','id','ID','label','Label'])
        const lat = num(pickFirst(r, ['latitude','Latitude','lat','LAT','Lat']))
        const lon = num(pickFirst(r, ['longitude','Longitude','lon','LONG','Long','Lng','lng','long']))
        const sraw = pickFirst(r, ['string','String','string_id','StringID','string_no','StringNo','str','Str','cable','Cable'])
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const stringId = sraw != null && String(sraw).trim() !== '' ? String(sraw).trim() : undefined
          pts.push({ name: String(name ?? ''), lat: Number(lat), lon: Number(lon), stringId })
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
        const labelBase = p.name ? String(p.name) : `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`
        const label = p.stringId ? `${labelBase} (String ${p.stringId})` : labelBase
        marker
          .addTo(layerRef.current)
          .bindTooltip(label, { direction: 'top', offset: [-14, -10] })
        bounds.extend([p.lat, p.lon] as any)
      }
      // Draw polylines connecting points with the same stringId (in CSV order)
      const groups = new Map<string, Array<[number, number]>>()
      for (const p of points) {
        if (!p.stringId) continue
        const key = p.stringId
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push([p.lat, p.lon])
      }
      for (const [key, coords] of groups) {
        if (coords.length < 2) continue
        const color = stringToColor(key)
        L.polyline(coords as any, { color, weight: 3, opacity: 0.9 }).addTo(layerRef.current)
      }

      // Draw a boundary polygon (convex hull) around the windfarm
      const allCoords: Array<[number, number]> = points.map(p => [p.lat, p.lon])
      if (allCoords.length >= 3) {
        const hull = convexHullLatLng(allCoords)
        if (hull.length >= 3) {
          L.polygon(hull as any, { color: '#555', weight: 2, dashArray: '6,4', fill: false }).addTo(layerRef.current)
        }
      }
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.1))
      }
    })()
    return () => { /* no-op */ }
  }, [points])


  return (
    <PageWithLibrary
      title="Layout Map"
      sidebar={(
        <>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <FileSelector
                libraryFiles={libraryFiles ?? undefined}
                selectedFile={layoutPath}
                onFileSelect={async (fp) => {
                  if (!/\.csv$/i.test(fp)) return
                  setLayoutPath(fp)
                  await loadLayout(fp)
                }}
                showActions={false}
                defaultExpandFolders={["project/plant"]}
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
        </>
      )}
    >
      <div style={{ marginTop: 12 }}>
        <div ref={mapRef} style={{ width: '100%', height: 520, border: '1px solid var(--color-border)', borderRadius: 6 }} />
      </div>

      <details style={{ marginTop: 12 }}>
        <summary>Debug: Points ({points.length})</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(points.slice(0, 50), null, 2)}</pre>
      </details>
    </PageWithLibrary>
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

// Deterministic string -> color using a fixed, high-contrast palette
const STRING_COLOR_PALETTE = [
  '#e41a1c', // red
  '#377eb8', // blue
  '#4daf4a', // green
  '#984ea3', // purple
  '#ff7f00', // orange
  '#ffff33', // yellow
  '#a65628', // brown
  '#f781bf', // pink
  '#999999', // gray
  '#1b9e77', // teal
  '#d95f02', // orange2
  '#7570b3', // violet
]

function stringToColor(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i)
  const idx = Math.abs(hash) % STRING_COLOR_PALETTE.length
  return STRING_COLOR_PALETTE[idx]
}

// Convex hull (Monotone chain) for [lat, lon] tuples; sorts by lon then lat
function convexHullLatLng(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length < 3) return points.slice()
  const pts = points.slice().sort((a, b) => (a[1] - b[1]) || (a[0] - b[0])) // sort by lon (x), then lat (y)
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
  const lower: Array<[number, number]> = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Array<[number, number]> = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}
