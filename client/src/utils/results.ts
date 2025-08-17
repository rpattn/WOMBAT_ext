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
export type NormalizedOutput = {
  series: NormalizedSeries[]
  table: { columns: string[]; rows: any[][] }
}

export function normalizeForPlotly(params: { summaries: { run: string; data: SummaryObject }[]; metricKeys: string[] }): NormalizedOutput {
  const { summaries, metricKeys } = params
  const series: NormalizedSeries[] = []
  const tableColumns = ['run', ...metricKeys]
  const tableRows: any[][] = []

  for (const s of summaries) {
    const y = metricKeys.map(k => safeNumber(s.data?.[k]))
    series.push({ x: metricKeys, y, name: s.run, type: 'bar' })
    tableRows.push([s.run, ...y])
  }

  return { series, table: { columns: tableColumns, rows: tableRows } }
}

function safeNumber(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
