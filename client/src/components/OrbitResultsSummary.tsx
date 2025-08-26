export type OrbitSummary = {
  generated_at?: string
  highlights?: {
    engine?: string
    status?: string
  }
  result?: {
    status?: string
    name?: string
    library?: string
    results?: Record<string, unknown>
    stats?: {
      runtime_seconds?: number | string
    }
  }
}

type Props = { data?: any }

function fmtCurrency(v: unknown): string {
  const num = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN)
  if (!isFinite(num)) return String(v ?? '—')
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
  } catch {
    return `$${Math.round(num).toLocaleString()}`
  }
}

function fmtNumber(v: unknown, digits = 3): string {
  const num = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN)
  if (!isFinite(num)) return String(v ?? '—')
  return num.toFixed(digits)
}

export default function OrbitResultsSummary({ data }: Props) {
  const src: OrbitSummary | undefined = data

  if (!src || typeof src !== 'object') {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>ORBIT Results</h3>
        <p>No ORBIT summary loaded.</p>
      </div>
    )
  }

  const gen = src.generated_at ?? '—'
  const hl = src.highlights || {}
  const res = src.result || {}
  const breakdown = (res.results && typeof res.results === 'object') ? (res.results as Record<string, unknown>) : {}
  const stats = res.stats || {}

  // Sort breakdown by descending value when numeric; otherwise alphabetically
  const entries = Object.entries(breakdown)
  entries.sort((a, b) => {
    const an = Number(typeof a[1] === 'string' ? Number(a[1]) : a[1])
    const bn = Number(typeof b[1] === 'string' ? Number(b[1]) : b[1])
    const aNum = isFinite(an)
    const bNum = isFinite(bn)
    if (aNum && bNum) return bn - an
    if (aNum) return -1
    if (bNum) return 1
    return a[0].localeCompare(b[0])
  })

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Simulation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', rowGap: 6, columnGap: 12 }}>
          <div>Generated</div><div>{gen}</div>
          <div>Engine</div><div>{hl.engine || 'ORBIT'}</div>
          <div>Status</div><div>{hl.status || res.status || '—'}</div>
          <div>Name</div><div>{res.name || '—'}</div>
          <div>Library</div><div style={{ wordBreak: 'break-all' }}>{res.library || '—'}</div>
          {stats && (stats as any).runtime_seconds != null && (
            <>
              <div>Runtime (s)</div><div>{fmtNumber((stats as any).runtime_seconds, 3)}</div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Cost Breakdown</h3>
        {entries.length === 0 ? (
          <p>No breakdown available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
