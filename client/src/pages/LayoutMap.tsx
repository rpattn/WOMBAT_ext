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
  const [points, setPoints] = useState<Array<{ id?: string; name: string; lat: number; lon: number; stringId?: string }>>([])
  const [turbineEnergy, setTurbineEnergy] = useState<Record<string, number>>({})
  const [turbineMaint, setTurbineMaint] = useState<Record<string, { count: number; hours: number }>>({})
  const [eventsCsvPath, setEventsCsvPath] = useState<string>('')
  const [summaryYamlPath, setSummaryYamlPath] = useState<string>('')
  const [resultGroups, setResultGroups] = useState<Record<string, { summaries: string[]; events: string[] }>>({})
  const [selectedGroup, setSelectedGroup] = useState<string>('')
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

  // When libraryFiles update, select a default layout and optionally load it.
  // Also detect and build result groups and load selected group's summary/events to enrich popups.
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
    // Build groups of results by subfolder under results/, e.g., results/2025-08-19_19-27-28/
    const yamlList = libraryFiles.yaml_files || []
    const csvList = libraryFiles.csv_files || []
    const summaries = yamlList.filter(p => /(^|[\\/])results[\\/].*summary\.(ya?ml)$/i.test(p))
    const events = csvList.filter(p => /(^|[\\/])results[\\/].*events\.csv$/i.test(p))
    const groups: Record<string, { summaries: string[]; events: string[] }> = {}
    const getKey = (p: string) => {
      // Extract immediate folder name after results/
      const m = String(p).match(/(^|[\\/])results[\\/]([^\\/]+)[\\/]/i)
      return m ? m[2] : 'ungrouped'
    }
    for (const s of summaries) {
      const k = getKey(s)
      if (!groups[k]) groups[k] = { summaries: [], events: [] }
      groups[k].summaries.push(s)
    }
    for (const e of events) {
      const k = getKey(e)
      if (!groups[k]) groups[k] = { summaries: [], events: [] }
      groups[k].events.push(e)
    }
    setResultGroups(groups)
    // Select latest group by lexicographic order, else 'ungrouped'
    const keys = Object.keys(groups)
    const sorted = keys.filter(k => k !== 'ungrouped').sort()
    const def = (sorted.length ? sorted[sorted.length - 1] : (keys.includes('ungrouped') ? 'ungrouped' : ''))
    setSelectedGroup(def)
    // Prefer files inside the selected results subfolder
    setSummaryYamlPath(def && groups[def]?.summaries?.[0] ? groups[def].summaries[0] : '')
    setEventsCsvPath(def && groups[def]?.events?.[0] ? groups[def].events[0] : '')
  }, [libraryFiles])

  // Load energy/maintenance when selected group or chosen files change
  useEffect(() => {
    // Energy from selected summary
    if (summaryYamlPath) {
      ;(async () => {
        try {
          const rf = await readFile(apiBaseUrl, requireSession, summaryYamlPath, false)
          const data = rf?.data
          const energyMap = extractPerTurbineEnergy(data)
          setTurbineEnergy(energyMap)
        } catch (e) {
          console.warn('Failed to load summary yaml', e)
          setTurbineEnergy({})
        }
      })()
    } else {
      setTurbineEnergy({})
    }

    // Maintenance from selected events CSV
    if (eventsCsvPath) {
      ;(async () => {
        try {
          const rf = await readFile(apiBaseUrl, requireSession, eventsCsvPath, false)
          const text = typeof rf?.data === 'string' ? rf.data : (rf?.data ? JSON.stringify(rf.data) : '')
          const rows = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data as any[]
          const maintMap = extractMaintenanceStats(rows)
          setTurbineMaint(maintMap)
        } catch (e) {
          console.warn('Failed to load events CSV', e)
          setTurbineMaint({})
        }
      })()
    } else {
      setTurbineMaint({})
    }
  }, [summaryYamlPath, eventsCsvPath])

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
      const pts: Array<{ id?: string; name: string; lat: number; lon: number; stringId?: string }> = []
      for (const r of rows) {
        if (!r) continue
        const idVal = pickFirst(r, [
          // Prefer explicit system/turbine identifiers when present
          'system_name','SystemName','system_id','SystemID',
          'turbine','Turbine',
          // Generic ids and labels
          'id','ID','name','Name','label','Label',
        ])
        const name = pickFirst(r, [
          'name','Name','label','Label',
          // Also consider turbine/system names as display names
          'turbine','Turbine','system_name','SystemName',
          // Fallback to id fields
          'id','ID'
        ])
        const lat = num(pickFirst(r, ['latitude','Latitude','lat','LAT','Lat']))
        const lon = num(pickFirst(r, ['longitude','Longitude','lon','LONG','Long','Lng','lng','long']))
        const sraw = pickFirst(r, ['string','String','string_id','StringID','string_no','StringNo','str','Str','cable','Cable'])
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const stringId = sraw != null && String(sraw).trim() !== '' ? String(sraw).trim() : undefined
          const id = idVal != null && String(idVal).trim() !== '' ? String(idVal).trim() : undefined
          pts.push({ id, name: String(name ?? ''), lat: Number(lat), lon: Number(lon), stringId })
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
        const energy = lookupEnergy(turbineEnergy, p)
        const maint = lookupMaint(turbineMaint, p)
        const popupHtml = `
          <div style="min-width:200px">
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(p.name || '')}${p.id ? ` <span style='color:#888'>(ID: ${escapeHtml(p.id)})</span>` : ''}</div>
            ${p.stringId ? `<div><strong>String:</strong> ${escapeHtml(p.stringId)}</div>` : ''}
            <div><strong>Location:</strong> ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</div>
            ${Number.isFinite(energy as any) ? `<div><strong>Energy:</strong> ${Number(energy).toFixed(1)} MWh</div>` : ''}
            ${(maint && (maint.count > 0 || maint.hours > 0)) ? `<div><strong>Maintenance:</strong> ${maint.count} events, ${maint.hours.toFixed(1)} h</div>` : ''}
          </div>`
        marker
          .addTo(layerRef.current)
          .bindTooltip(label, { direction: 'top', offset: [-14, -10] })
          .bindPopup(popupHtml)
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
  }, [points, turbineEnergy, turbineMaint])


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
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Results group</div>
                <select
                  className="form-control"
                  value={selectedGroup}
                  onChange={(e) => {
                    const g = e.target.value
                    setSelectedGroup(g)
                    const grp = resultGroups[g] || { summaries: [], events: [] }
                    setSummaryYamlPath(grp.summaries[0] || '')
                    setEventsCsvPath(grp.events[0] || '')
                  }}
                >
                  {Object.entries(resultGroups).sort(([a],[b]) => a.localeCompare(b)).map(([k, v]) => (
                    <option key={k} value={k}>{k} ({v.summaries.length} sum, {v.events.length} evt)</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
                  Summary: <code>{summaryYamlPath || '(none)'}</code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  Events: <code>{eventsCsvPath || '(none)'}</code>
                </div>
              </div>
              {Object.keys(turbineEnergy).length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  Loaded per-turbine energy from <code>results/summary.yaml</code>
                </div>
              )}
              {Object.keys(turbineMaint).length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  Loaded maintenance stats from <code>{eventsCsvPath || 'events.csv'}</code>
                </div>
              )}
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
      {Object.keys(turbineEnergy).length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Debug: Per-turbine energy entries ({Object.keys(turbineEnergy).length})</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(Object.fromEntries(Object.entries(turbineEnergy).slice(0, 50)), null, 2)}</pre>
        </details>
      )}
      {Object.keys(turbineMaint).length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Debug: Maintenance stats entries ({Object.keys(turbineMaint).length})</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(Object.fromEntries(Object.entries(turbineMaint).slice(0, 50)), null, 2)}</pre>
        </details>
      )}
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

// Try to extract a mapping of turbine identifier -> energy (MWh) from summary.yaml
function extractPerTurbineEnergy(obj: any): Record<string, number> {
  if (!obj || typeof obj !== 'object') return {}
  const candidates: any[] = []
  // Common shapes we support
  candidates.push(obj?.stats?.power_production?.per_component_energy_mwh)
  candidates.push(obj?.power_production?.per_component_energy_mwh)
  candidates.push(obj?.per_component_energy_mwh)
  candidates.push(obj?.turbines?.energy_mwh)
  // Some summaries might nest under results or similar
  candidates.push(obj?.results?.power_production?.per_component_energy_mwh)

  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const out: Record<string, number> = {}
      for (const [k, v] of Object.entries(c)) {
        const n = Number(v)
        if (Number.isFinite(n)) out[String(k)] = n
      }
      if (Object.keys(out).length) return out
    }
  }
  return {}
}

function lookupEnergy(map: Record<string, number>, p: { id?: string; name: string }): number | undefined {
  if (!map) return undefined
  // Try by name, then id, then case-insensitive
  if (p.name && map[p.name] != null) return map[p.name]
  if (p.id && map[p.id] != null) return map[p.id]
  const nameKey = Object.keys(map).find(k => p.name && k.toLowerCase() === p.name.toLowerCase())
  if (nameKey) return map[nameKey]
  if (p.id) {
    const idKey = Object.keys(map).find(k => k.toLowerCase() === p.id!.toLowerCase())
    if (idKey) return map[idKey]
  }
  return undefined
}

// Build a map of turbine identifier -> { count, hours } for maintenance/repair events
function extractMaintenanceStats(rows: any[]): Record<string, { count: number; hours: number }> {
  const out: Record<string, { count: number; hours: number }> = {}
  if (!Array.isArray(rows)) return out
  for (const r of rows) {
    if (!r) continue
    const action = String(r.action ?? r.Action ?? '').toLowerCase()
    if (action !== 'maintenance' && action !== 'repair') continue
    // duration in hours
    const dur = Number(r.duration ?? r.Duration ?? r.duration_hours ?? r.Hours ?? 0)
    if (!Number.isFinite(dur) || dur <= 0) continue
    // turbine identifier: prefer explicit turbine/turbine_id, fall back to id/name/label
    const tid = pickFirst(r, [
      // Common turbine fields
      'turbine','Turbine','turbine_id','TurbineID','turbine_name','TurbineName',
      // Provided schema likely uses system_name/system_id as the turbine identifier
      'system_name','SystemName','system_id','SystemID',
      // Fallbacks
      'id','ID','name','Name','label','Label',
    ])
    const key = tid != null && String(tid).trim() !== '' ? String(tid).trim() : undefined
    if (!key) continue
    if (!out[key]) out[key] = { count: 0, hours: 0 }
    out[key].count += 1
    out[key].hours += dur
  }
  return out
}

function lookupMaint(map: Record<string, { count: number; hours: number }>, p: { id?: string; name: string }) {
  if (!map) return undefined
  if (p.name && map[p.name]) return map[p.name]
  if (p.id && map[p.id]) return map[p.id]
  const nameKey = Object.keys(map).find(k => p.name && k.toLowerCase() === p.name.toLowerCase())
  if (nameKey) return map[nameKey]
  if (p.id) {
    const idKey = Object.keys(map).find(k => k.toLowerCase() === p.id!.toLowerCase())
    if (idKey) return map[idKey]
  }
  return undefined
}

// Basic HTML escape to prevent injecting unsafe content into popup HTML
function escapeHtml(input: string): string {
  if (input == null) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
