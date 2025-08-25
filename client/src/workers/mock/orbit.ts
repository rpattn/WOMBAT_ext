import type { FileEntry } from './types';

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

export function runMockOrbitSimulation(store: Map<string, FileEntry>, opts?: { configPath?: string }) {
  // Derive a tiny bit of variability from base.yaml if present
  const base = store.get('project\\config\\base.yaml');
  const scale = (() => {
    try {
      const nt = Number((base && base.kind === 'yaml' && (base as any).data?.parameters?.turbines) || 5);
      return Math.max(1, Math.min(20, nt));
    } catch {
      return 5;
    }
  })();

  const runtime = Number((Math.random() * 20 + 8).toFixed(2));
  // USD costs scaled by turbines
  const breakdown: Record<string, number> = {
    turbine_supply: Math.round(1_100_000 * scale),
    installation: Math.round(450_000 * scale),
    support_structures: Math.round(380_000 * scale),
    cable_supply: Math.round(120_000 * scale),
    cable_installation: Math.round(140_000 * scale),
    project_management: Math.round(90_000 * scale),
    port_fees: Math.round(35_000 * scale),
    contingency: Math.round(0.08 * (
      1_100_000 + 450_000 + 380_000 + 120_000 + 140_000 + 90_000 + 35_000
    ) * scale),
  };

  const generated_at = new Date().toISOString();
  const summary: any = {
    generated_at,
    highlights: { engine: 'ORBIT', status: 'finished' },
    result: {
      status: 'finished',
      name: opts?.configPath ? `Mock ORBIT (${opts.configPath})` : 'Mock ORBIT',
      library: 'mock_project',
      results: breakdown,
      stats: { runtime_seconds: runtime },
    },
  };

  // Write top-level summary so UI can load it easily if selected
  store.set('orbit_summary.yaml', { kind: 'yaml', data: summary });

  // Also write into a timestamped results directory
  const stamp = nowStamp();
  const dir = `results\\orbit\\${stamp}`;
  store.set(`${dir}\\orbit_summary.yaml`, { kind: 'yaml', data: summary });

  // CSV breakdown for convenience
  const csvLines = ['item,value', ...Object.entries(breakdown).map(([k, v]) => `${k},${v}`)];
  store.set(`${dir}\\costs.csv`, { kind: 'text', mime: 'text/csv', data: csvLines.join('\n') + '\n' });

  // Minimal HTML report
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mock ORBIT Report</title></head>
  <body>
    <h1>Mock ORBIT Report</h1>
    <p>Generated: ${generated_at}</p>
    <p>Runtime (s): ${runtime}</p>
    <h2>Cost Breakdown</h2>
    <table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>Item</th><th>USD</th></tr></thead>
      <tbody>
        ${Object.entries(breakdown).map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${v.toLocaleString()}</td></tr>`).join('')}
      </tbody>
    </table>
  </body></html>`;
  store.set(`${dir}\\report.html`, { kind: 'text', mime: 'text/html', data: html });

  // Return object consistent with other mocks
  // Also mirror default simulation outputs so downstream UI expects the same files
  const total_cost = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const simSummaryPath = 'results\\summary.yaml';
  const simSummary: any = {
    summary: 'Mock ORBIT simulation complete',
    status: 'finished',
    finished_at: generated_at,
    task: 'orbit',
    orbit: { runtime_seconds: runtime },
    costs: breakdown,
    total_cost: total_cost,
  };
  store.set(simSummaryPath, { kind: 'yaml', data: simSummary });

  // Minimal metrics.csv (total_cost only)
  const metricsCsv = 'metric,value\n' + `total_cost,${total_cost}\n`;
  store.set('results\\metrics.csv', { kind: 'text', mime: 'text/csv', data: metricsCsv });

  // Reuse the HTML report content at a default location
  store.set('results\\report.html', { kind: 'text', mime: 'text/html', data: html });

  // Lightweight operations.csv (time,value) placeholder to match default presence
  const opHeader = 'env_datetime|env_time|value';
  const opRows: string[] = [opHeader];
  for (let h = 0; h < 24; h++) {
    const dt = new Date(Date.now() + h * 3_600_000).toISOString();
    const val = Number((0.8 + 0.2 * Math.sin(h / 24 * 2 * Math.PI)).toFixed(3));
    opRows.push([dt, String(h), String(val)].join('|'));
  }
  const operationsCsv = opRows.join('\n') + '\n';
  store.set('results\\operations.csv', { kind: 'text', mime: 'text/csv', data: operationsCsv });

  return { ok: true, ...summary };
}
