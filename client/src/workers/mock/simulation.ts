import type { FileEntry } from './types';

// Create/update results files and return a mock result payload
export function runMockSimulation(store: Map<string, FileEntry>) {
  const base = store.get('project\\config\\base.yaml');
  const nTurbines = Number((base && base.kind === 'yaml' && (base as any).data?.parameters?.turbines) || 5);
  const startTime = new Date('2003-01-01T00:00:00Z');
  const endTime = new Date('2003-12-31T23:59:59Z');
  const hours = Math.round((endTime.getTime() - startTime.getTime()) / 3_600_000);
  const energy = 2500 * nTurbines; // MWh total energy
  const capacityMw = 3 * nTurbines; // 3 MW per V90
  const avgPowerMw = energy / hours;
  const peakPowerMw = Math.max(avgPowerMw * 2.5, Math.min(capacityMw * 0.85, capacityMw));
  const capacityFactor = capacityMw > 0 ? avgPowerMw / capacityMw : 0;

  const monthly_energy_mwh: Record<string, number> = {};
  let monthlySum = 0;
  for (let m = 1; m <= 12; m++) {
    const w = 1 + 0.3 * Math.cos(((m - 3) / 12) * 2 * Math.PI);
    const key = `${startTime.getUTCFullYear()}-${String(m).padStart(2, '0')}`;
    monthly_energy_mwh[key] = w;
    monthlySum += w;
  }
  for (let m = 1; m <= 12; m++) {
    const key = `${startTime.getUTCFullYear()}-${String(m).padStart(2, '0')}`;
    monthly_energy_mwh[key] = Number(((monthly_energy_mwh[key] / monthlySum) * energy).toFixed(2));
  }

  const per_component_energy_mwh: Record<string, number> = {};
  const components = Math.min(nTurbines, 6);
  const perComp = energy / components;
  for (let i = 1; i <= components; i++) {
    const name = `T${String(i).padStart(2, '0')}`;
    per_component_energy_mwh[name] = Number((perComp * (0.9 + 0.02 * i)).toFixed(2));
  }

  const totalRequests = Math.round(8 * (nTurbines / 5));
  const avgPerMonth = totalRequests / 12;
  const peakMonth = `${startTime.getUTCFullYear()}-03`;
  const peakMonthCount = Math.max(1, Math.round(avgPerMonth * 1.5));
  const requests_by_type = { repair: Math.round(totalRequests * 0.6), service: Math.round(totalRequests * 0.4) } as Record<string, number>;
  const requests_by_component: Record<string, number> = {};
  for (let i = 1; i <= Math.min(nTurbines, 5); i++) {
    requests_by_component[`T${String(i).padStart(2, '0')}`] = Math.max(0, Math.round(totalRequests / Math.min(nTurbines, 5) + (i - 3)));
  }

  const summaryPath = 'results\\summary.yaml';
  const summary: any = {
    summary: 'Mock simulation complete',
    status: 'finished',
    finished_at: new Date().toISOString(),
    task: 'mock',
    energy_mwh: energy,
    capacity_mw: capacityMw,
    stats: {
      maintenance: {
        total_requests: totalRequests,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        average_requests_per_month: Number(avgPerMonth.toFixed(1)),
        peak_month: peakMonth,
        peak_month_count: peakMonthCount,
        requests_by_type,
        requests_by_component,
      },
      power_production: {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hours,
        windfarm_energy_mwh: Number(energy.toFixed(2)),
        avg_windfarm_power_mw: Number(avgPowerMw.toFixed(2)),
        peak_windfarm_power_mw: Number(peakPowerMw.toFixed(2)),
        capacity_factor: Number(capacityFactor.toFixed(3)),
        monthly_energy_mwh,
        per_component_energy_mwh,
      },
    },
  };
  store.set(summaryPath, { kind: 'yaml', data: summary });
  const resCsv = 'metric,value\nenergy_mwh,' + energy + '\n';
  store.set('results\\metrics.csv', { kind: 'text', mime: 'text/csv', data: resCsv });
  store.set('results\\report.html', {
    kind: 'text',
    mime: 'text/html',
    data: `<!doctype html><html><head><meta charset="utf-8"><title>Mock Report</title></head><body><h1>Mock Report</h1><p>Energy (MWh): ${energy}</p></body></html>`,
  });
  // Create a lightweight operations.csv for the Operations page
  // Pipe-delimited with columns: env_datetime | env_time | T01 | T02 | ...
  const systems: string[] = [];
  for (let i = 1; i <= Math.min(nTurbines, 12); i++) {
    systems.push(`T${String(i).padStart(2, '0')}`);
  }
  const header = ['env_datetime', 'env_time', ...systems].join('|');
  const rows: string[] = [header];
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  for (let h = 0; h < hours; h++) {
    const dt = new Date(startTime.getTime() + h * 3_600_000);
    const envTime = h; // hours since start
    const vals: number[] = [];
    for (let s = 0; s < systems.length; s++) {
      // Deterministic availability between 0 and 1 with occasional dips
      const base = 0.9 + 0.08 * Math.sin((h / 24) * 2 * Math.PI + s * 0.5);
      const weekly = 0.03 * Math.sin((h / (24 * 7)) * 2 * Math.PI + s);
      let avail = clamp01(base + weekly);
      // Periodic short outage windows per-system
      const outageSpan = 2 + (s % 2); // 2-3 hours
      const outageEvery = 160 + s * 7; // staggered pattern
      if (h % outageEvery < outageSpan) {
        avail = Math.max(0, avail - 0.8);
      }
      vals.push(Number(avail.toFixed(3)));
    }
    rows.push([dt.toISOString(), String(envTime), ...vals.map(v => String(v))].join('|'));
  }
  const operationsCsv = rows.join('\n') + '\n';
  store.set('results\\operations.csv', { kind: 'text', mime: 'text/csv', data: operationsCsv });
  return { ok: true, energy_mwh: energy };
}
