// Utilities for parsing and normalizing results/events for Plotly
// Uses dynamic imports to avoid bloating the initial bundle.

export type SummaryObject = Record<string, any>
export type EventRow = Record<string, any>

export async function parseSummaryYaml(text: string): Promise<SummaryObject> {
  try {
    const mod = await import('js-yaml')
    const doc = mod.load(text)
    return (doc && typeof doc === 'object') ? (doc as any) : {}
  } catch (e) {
    console.warn('parseSummaryYaml failed', e)
    return {}
  }
}

export async function parseCsvEvents(text: string): Promise<EventRow[]> {
  try {
    const mod = await import('papaparse')
    const res = mod.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    if (Array.isArray(res.data)) return res.data as EventRow[]
    return []
  } catch (e) {
    console.warn('parseCsvEvents failed', e)
    return []
  }
}

export type NormalizedSeries = { x: any[]; y: any[]; name: string; type?: string }
export type NormalizationMode = 'none' | 'minmax' | 'zscore' | 'log10'
export type NormalizedOutput = {
  series: NormalizedSeries[]
  table: { columns: string[]; rows: any[][] }
}

export function normalizeForPlotly(params: {
  summaries: { run: string; data: SummaryObject }[]
  metricKeys: string[]
  normalization?: NormalizationMode
  percentDiff?: { enabled: boolean; baselineRun?: string }
}): NormalizedOutput {
  const { summaries, metricKeys } = params
  const mode: NormalizationMode = params.normalization ?? 'none'
  const series: NormalizedSeries[] = []
  const tableColumns = ['run', ...metricKeys]
  const tableRows: any[][] = []

  // Build raw matrix [runIndex][metricIndex]
  const rawMatrix: number[][] = summaries.map(s => metricKeys.map(k => safeNumber(getNestedValue(s.data, k))))
  // If percent-diff requested, compute relative to baseline per metric
  let displayMatrix: number[][]
  if (params.percentDiff?.enabled) {
    const baselineIndex = summaries.findIndex(s => s.run === params.percentDiff?.baselineRun)
    const idx = baselineIndex >= 0 ? baselineIndex : 0
    const eps = 1e-12
    displayMatrix = rawMatrix.map((row) => row.map((v, j) => {
      const base = rawMatrix[idx][j]
      if (!isFinite(base) || Math.abs(base) < eps) return 0
      return ((v - base) / base) * 100
    }))
  } else {
    // Transpose to per-metric arrays
    const perMetric: number[][] = metricKeys.map((_, j) => rawMatrix.map(row => row[j]))
    // Normalize per metric
    const perMetricNorm: number[][] = perMetric.map(vals => normalizeArray(vals, mode))
    // Reconstruct per-run normalized values
    displayMatrix = summaries.map((_, i) => metricKeys.map((_, j) => perMetricNorm[j][i]))
  }

  // Build outputs
  summaries.forEach((s, i) => {
    const y = displayMatrix[i]
    series.push({ x: metricKeys, y, name: s.run, type: 'bar' })
    // Table shows raw values for readability
    tableRows.push([s.run, ...rawMatrix[i]])
  })

  return { series, table: { columns: tableColumns, rows: tableRows } }
}

function safeNumber(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function getNestedValue(obj: any, path: string): any {
  if (!obj) return undefined
  if (!path) return undefined
  const parts = path.split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
    else return undefined
  }
  return cur
}

function normalizeArray(values: number[], mode: NormalizationMode): number[] {
  switch (mode) {
    case 'minmax': {
      let min = Infinity, max = -Infinity
      for (const v of values) { if (v < min) min = v; if (v > max) max = v }
      const range = max - min
      if (!isFinite(range) || range === 0) return values.map(() => 0)
      return values.map(v => (v - min) / range)
    }
    case 'zscore': {
      const n = values.length || 1
      const mean = values.reduce((a, b) => a + b, 0) / n
      const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n
      const std = Math.sqrt(variance)
      if (!isFinite(std) || std === 0) return values.map(() => 0)
      return values.map(v => (v - mean) / std)
    }
    case 'log10': {
      const eps = 1e-9
      return values.map(v => Math.log10(Math.max(eps, Math.abs(v))))
    }
    case 'none':
    default:
      return values.slice()
  }
}
