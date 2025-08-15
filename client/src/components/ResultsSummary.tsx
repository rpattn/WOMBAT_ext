import { useWebSocketContext } from '../context/WebSocketContext';

export default function ResultsSummary() {
  const { results } = useWebSocketContext();

  if (!results) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Results</h3>
        <p>No results yet. Run a simulation to see summary statistics.</p>
      </div>
    );
  }

  const stats = results.stats ?? {};
  const maint = stats.maintenance ?? {};
  const power = stats.power_production ?? {};

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Simulation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', rowGap: 6, columnGap: 12 }}>
          <div>Status</div><div>{results.status ?? 'unknown'}</div>
          {results.files && (
            <>
              <div>Events log</div><div>{results.files.events_log}</div>
              <div>Operations log</div><div>{results.files.operations_log}</div>
              <div>Power potential</div><div>{results.files.power_potential}</div>
              <div>Power production</div><div>{results.files.power_production}</div>
              <div>Metrics input</div><div>{results.files.metrics_input}</div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Maintenance Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', rowGap: 6, columnGap: 12 }}>
          <div>Total requests</div><div>{maint.total_requests ?? 0}</div>
          <div>Time range</div><div>{maint.start_time ?? '—'} → {maint.end_time ?? '—'}</div>
          <div>Avg per month</div><div>{typeof maint.average_requests_per_month === 'number' ? maint.average_requests_per_month.toFixed(1) : '—'}</div>
          <div>Peak month</div><div>{maint.peak_month ? `${maint.peak_month} (${maint.peak_month_count})` : '—'}</div>
        </div>
        {(maint.requests_by_type || maint.requests_by_component) && (
          <div style={{ marginTop: 12 }}>
            <details open>
              <summary>Breakdown</summary>
              <div className="row stack-sm">
                <div className="col col-1-2">
                  <h4>By type</h4>
                  <ul>
                    {Object.entries(maint.requests_by_type ?? {}).map(([k, v]) => (
                      <li key={k}><strong>{k}</strong>: {String(v)}</li>
                    ))}
                  </ul>
                </div>
                <div className="col col-1-2">
                  <h4>Top components</h4>
                  <ul>
                    {Object.entries(maint.requests_by_component ?? {}).map(([k, v]) => (
                      <li key={k}><strong>{k}</strong>: {String(v)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Power Production Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', rowGap: 6, columnGap: 12 }}>
          <div>Time range</div><div>{power.start_time ?? '—'} → {power.end_time ?? '—'}</div>
          <div>Hours</div><div>{power.hours ?? 0}</div>
          <div>Total energy (MWh)</div><div>{typeof power.windfarm_energy_mwh === 'number' ? power.windfarm_energy_mwh.toFixed(2) : '—'}</div>
          <div>Avg power (MW)</div><div>{typeof power.avg_windfarm_power_mw === 'number' ? power.avg_windfarm_power_mw.toFixed(2) : '—'}</div>
          <div>Peak power (MW)</div><div>{typeof power.peak_windfarm_power_mw === 'number' ? power.peak_windfarm_power_mw.toFixed(2) : '—'}</div>
          <div>Capacity factor</div><div>{typeof power.capacity_factor === 'number' ? (power.capacity_factor * 100).toFixed(1) + '%' : '—'}</div>
        </div>
        {(power.monthly_energy_mwh || power.per_component_energy_mwh) && (
          <div style={{ marginTop: 12 }}>
            <details>
              <summary>Additional breakdowns</summary>
              <div className="row stack-sm">
                <div className="col col-1-2">
                  <h4>Monthly energy (MWh)</h4>
                  <ul>
                    {Object.entries(power.monthly_energy_mwh ?? {}).map(([k, v]) => (
                      <li key={k}><strong>{k}</strong>: {Number(v).toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
                <div className="col col-1-2">
                  <h4>Per-component energy (MWh)</h4>
                  <ul>
                    {Object.entries(power.per_component_energy_mwh ?? {}).map(([k, v]) => (
                      <li key={k}><strong>{k}</strong>: {Number(v).toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
