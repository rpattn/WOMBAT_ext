// Mock API Web Worker
// Simulates server responses when backend is unavailable.
// Endpoints covered:
// - POST /api/session -> { client_id }
// - DELETE /api/session/{client_id} -> { status: 'ended' }
// - GET /api/{client_id}/refresh -> { files, config, saved }
// - GET /api/{client_id}/library/files -> FilesScan
// - GET /api/{client_id}/config -> object
// - GET /api/{client_id}/library/file?path&raw -> ReadFileResponse
// - PUT /api/{client_id}/library/file -> OkWithFiles
// - DELETE /api/{client_id}/library/file?file_path -> OkWithFiles
// - GET /api/saved -> SavedList
// - POST /api/{client_id}/saved/load -> OkWithFilesAndMessage
// - DELETE /api/saved/{name} -> OkMessage
// - POST /api/{client_id}/simulate -> SimulationResult
// - POST /api/{client_id}/simulate/trigger -> SimulationTrigger
// - GET  /api/simulate/status/{task_id} -> SimulationStatus

export type WorkerRequest = {
  id: string;
  method: string;
  path: string; // e.g., "/api/session"
  body?: any;
};

export type WorkerResponse = {
  id: string;
  ok: boolean;
  status: number;
  json?: any;
  error?: string;
};

// Simple in-memory state for mock sessions
const activeClients = new Set<string>();

type FileEntry = { kind: 'text' | 'yaml' | 'binary'; mime?: string; data: any };
const clientStores = new Map<string, Map<string, FileEntry>>(); // per-client virtual FS

const savedLibraries = new Set<string>(['dinwoodie_mock', 'dinwoodie_base']);
type Task = { clientId: string; status: 'running' | 'finished' | 'unknown'; result?: any };
const tasks = new Map<string, Task>();

function tinyPngB64(): string {
  // 1x1 transparent PNG
  return (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBgVnQp5kAAAAASUVORK5CYII='
  );
}

function templateLibrary(name = 'Dinwoodie Mock'): Map<string, FileEntry> {
  const fs = new Map<string, FileEntry>();
  // Base configuration modeled after dinwoodie/project/config/base.yaml
  fs.set('project\\config\\base.yaml', {
    kind: 'yaml',
    data: {
      name: (name || 'dinwoodie_base').toLowerCase().replace(/\s+/g, '_'),
      library: 'DINWOODIE',
      weather: 'alpha_ventus_weather_2002_2014.csv',
      service_equipment: ['ctv1.yaml', 'ctv2.yaml', 'ctv3.yaml', 'fsv_requests.yaml', 'hlv_requests.yaml'],
      layout: 'layout.csv',
      inflation_rate: 0,
      fixed_costs: 'fixed_costs.yaml',
      workday_start: 7,
      workday_end: 19,
      start_year: 2003,
      end_year: 2012,
      project_capacity: 240,
      // Extra helper parameters for the mock simulation scaling
      parameters: { turbines: 5, cable_voltage_kv: 66 },
    },
  });

  // Windfarm layout (subset) modeled after dinwoodie/project/plant/layout.csv
  fs.set(
    'project\\plant\\layout.csv',
    {
      kind: 'text',
      mime: 'text/csv',
      data:
        'id,substation_id,name,type,longitude,latitude,string,order,distance,subassembly,upstream_cable\n' +
        'OSS1,OSS1,OSS1,substation,0,0,,,,offshore_substation.yaml,export.yaml\n' +
        'S00T1,OSS1,S00T1,turbine,0,0,0,0,0,vestas_v90.yaml,array.yaml\n' +
        'S00T2,OSS1,S00T2,turbine,0,0,0,1,0,vestas_v90.yaml,array.yaml\n' +
        'S00T3,OSS1,S00T3,turbine,0,0,0,2,0,vestas_v90.yaml,array.yaml\n',
    }
  );

  // Weather sample (very small) mirroring alpha_ventus_weather_2002_2014.csv columns
  fs.set(
    'weather\\alpha_ventus_weather_2002_2014.csv',
    {
      kind: 'text',
      mime: 'text/csv',
      data:
        'datetime,wind_ms,wave_hs_m,wave_tp_s,air_temp_c\n' +
        '2002-01-01T00:00:00Z,9.5,1.2,7.5,5.0\n' +
        '2002-01-01T01:00:00Z,10.1,1.3,7.7,4.9\n' +
        '2002-01-01T02:00:00Z,8.8,1.1,7.2,4.7\n',
    }
  );

  // Cables based on dinwoodie/cables
  fs.set('cables\\array.yaml', {
    kind: 'yaml',
    data: {
      name: 'array cable',
      maintenance: [{ description: 'n/a', time: 0, materials: 0, service_equipment: 'CTV', frequency: 0 }],
      failures: [
        {
          scale: 0,
          shape: 0,
          time: 0,
          materials: 0,
          operation_reduction: 0,
          service_equipment: 'CAB',
          level: 1,
          description: 'n/a',
        },
      ],
    },
  });
  fs.set('cables\\export.yaml', {
    kind: 'yaml',
    data: {
      name: 'export cable',
      maintenance: [{ description: 'n/a', time: 0, materials: 0, service_equipment: 'CTV', frequency: 0 }],
      failures: [
        {
          scale: 0,
          shape: 0,
          time: 0,
          materials: 0,
          operation_reduction: 0,
          service_equipment: 'CAB',
          level: 1,
          description: 'none',
        },
      ],
    },
  });

  // Turbine config and power curve based on dinwoodie/turbines
  fs.set('turbines\\vestas_v90.yaml', {
    kind: 'yaml',
    data: {
      capacity_kw: 3000,
      capex_kw: 1300,
      power_curve: { file: 'vestas_v90_power_curve.csv', bin_width: 0.5 },
      turbine: {
        name: 'turbine',
        maintenance: [
          { description: 'annual service', time: 60, materials: 18500, service_equipment: 'CTV', frequency: 365 },
        ],
        failures: [
          { scale: 10.1333, shape: 1, time: 3, materials: 0, service_equipment: 'CTV', operation_reduction: 0.0, level: 1, description: 'manual reset' },
          { scale: 10.3333, shape: 1, time: 7.5, materials: 1000, service_equipment: 'CTV', operation_reduction: 0.0, level: 2, description: 'minor repair' },
          { scale: 13.6363, shape: 1, time: 22, materials: 18500, service_equipment: 'CTV', operation_reduction: 0.0, level: 3, description: 'medium repair' },
          { scale: 125, shape: 1, time: 26, materials: 73500, service_equipment: 'SCN', operation_reduction: 0.0, level: 4, description: 'major repair' },
          { scale: 112.5, shape: 1, time: 52, materials: 334500, service_equipment: 'LCN', operation_reduction: 0.0, replacement: true, level: 5, description: 'major replacement' },
        ],
      },
    },
  });
  fs.set('turbines\\vestas_v90_power_curve.csv', {
    kind: 'text',
    mime: 'text/csv',
    data:
      'wind_ms,power_kw\n' +
      '4,50\n' +
      '6,250\n' +
      '8,600\n' +
      '10,1350\n' +
      '12,1800\n' +
      '14,2000\n',
  });

  // Vessels (subset) based on dinwoodie/vessels
  fs.set('vessels\\ctv1.yaml', {
    kind: 'yaml',
    data: {
      name: 'Crew Transfer Vessel 1',
      equipment_rate: 1750,
      start_month: 1,
      start_day: 1,
      end_month: 12,
      end_day: 31,
      start_year: 2002,
      end_year: 2014,
      onsite: true,
      capability: 'CTV',
      max_severity: 10,
      mobilization_cost: 0,
      mobilization_days: 0,
      speed: 37.04,
      max_windspeed_transport: 99,
      max_windspeed_repair: 99,
      max_waveheight_transport: 1.5,
      max_waveheight_repair: 1.5,
      strategy: 'scheduled',
      crew_transfer_time: 0.25,
      n_crews: 1,
      crew: { day_rate: 0, n_day_rate: 0, hourly_rate: 0, n_hourly_rate: 0 },
    },
  });
  fs.set('vessels\\ctv2.yaml', { kind: 'yaml', data: { name: 'Crew Transfer Vessel 2', capability: 'CTV', onsite: true } });
  fs.set('vessels\\ctv3.yaml', { kind: 'yaml', data: { name: 'Crew Transfer Vessel 3', capability: 'CTV', onsite: true } });

  // Service equipment request placeholders referenced by base.yaml
  fs.set('vessels\\fsv_requests.yaml', {
    kind: 'yaml',
    data: { name: 'fsv_requests', requests: [] },
  });
  fs.set('vessels\\hlv_requests.yaml', {
    kind: 'yaml',
    data: { name: 'hlv_requests', requests: [] },
  });

  // Fixed costs referenced by base.yaml
  fs.set('project\\config\\fixed_costs.yaml', {
    kind: 'yaml',
    data: {
      fixed_costs: {
        project_management_usd_per_year: 0,
        site_lease_usd_per_year: 0,
        insurance_usd_per_year: 0,
        monitoring_usd_per_year: 0,
      },
    },
  });

  fs.set('results\\summary.yaml', {
    kind: 'yaml',
    data: {
      summary: 'Mock summary for demonstration',
      energy_mwh: 12345,
      cables: { length_km: 12.3 },
    },
  });
  fs.set('results\\report.html', {
    kind: 'text',
    mime: 'text/html',
    data: '<!doctype html><html><head><meta charset="utf-8"><title>Mock Report</title></head><body><h1>Mock Report</h1><p>This is a mock HTML report.</p></body></html>',
  });
  fs.set('results\\plot.png', {
    kind: 'binary',
    mime: 'image/png',
    data: tinyPngB64(),
  });
  return fs;
}

function ensureClientStore(clientId: string): Map<string, FileEntry> {
  let store = clientStores.get(clientId);
  if (!store) {
    store = templateLibrary();
    clientStores.set(clientId, store);
  }
  return store;
}

function scanFiles(fs: Map<string, FileEntry>) {
  const yaml_files: string[] = [];
  const csv_files: string[] = [];
  const html_files: string[] = [];
  const png_files: string[] = [];
  for (const path of fs.keys()) {
    const p = path.toLowerCase();
    if (p.endsWith('.yaml') || p.endsWith('.yml')) yaml_files.push(path);
    else if (p.endsWith('.csv')) csv_files.push(path);
    else if (p.endsWith('.html')) html_files.push(path);
    else if (p.endsWith('.png')) png_files.push(path);
  }
  const total_files = fs.size;
  return { yaml_files, csv_files, html_files, png_files, total_files };
}

function getConfig(fs: Map<string, FileEntry>) {
  // Basic config from base.yaml if present
  const base = fs.get('project\\config\\base.yaml');
  if (base && base.kind === 'yaml') return base.data;
  return {};
}

function randomId(): string {
  // Short, readable mock id
  return 'mock-' + Math.random().toString(36).slice(2, 10);
}

export async function handleWorkerRequest(msg: WorkerRequest): Promise<WorkerResponse> {
  try {
    const { id, method, path } = msg;
    // Sessions
    if (method === 'POST' && path === '/api/session') {
      const cid = randomId();
      activeClients.add(cid);
      ensureClientStore(cid);
      return { id, ok: true, status: 200, json: { client_id: cid } };
    }

    // moved simulation handlers below after regex declarations

    if (method === 'DELETE' && path.startsWith('/api/session/')) {
      const cid = path.split('/').pop() || '';
      if (activeClients.has(cid)) {
        activeClients.delete(cid);
        return { id, ok: true, status: 200, json: { status: 'ended' } };
      } else {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
    }

    // Saved libraries
    if (method === 'GET' && path === '/api/saved') {
      return { id, ok: true, status: 200, json: { dirs: Array.from(savedLibraries) } };
    }

    if (method === 'DELETE' && path.startsWith('/api/saved/')) {
      const name = decodeURIComponent(path.substring('/api/saved/'.length));
      if (savedLibraries.has(name)) savedLibraries.delete(name);
      return { id, ok: true, status: 200, json: { ok: true, message: `Deleted ${name}` } };
    }

    // Schemas (no session required)
    if (method === 'GET' && path === '/api/schemas') {
      return { id, ok: true, status: 200, json: { available: [
        'configuration',
        'service_equipment',
        'service_equipment_scheduled',
        'service_equipment_unscheduled',
      ] } };
    }
    const schemaMatch = path.match(/^\/api\/schemas\/(.+)$/);
    if (schemaMatch && method === 'GET') {
      const name = decodeURIComponent(schemaMatch[1]).toLowerCase();
      // Minimal mock schemas
      if (name === 'configuration') {
        return { id, ok: true, status: 200, json: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          title: 'SimulationConfiguration',
          type: 'object',
          properties: {
            name: { type: 'string' },
            library: { type: 'string' },
            weather: { type: 'string' },
            layout: { type: 'string' },
            service_equipment: { type: 'array', items: { type: 'string' } },
          },
        } };
      }
      if (name === 'service_equipment' || name === 'vessel' || name === 'vessels') {
        return { id, ok: true, status: 200, json: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          title: 'ServiceEquipment',
          oneOf: [
            { title: 'ServiceEquipmentScheduled', type: 'object', properties: { strategy: { const: 'scheduled' }, name: { type: 'string' } } },
            { title: 'ServiceEquipmentUnscheduled', type: 'object', properties: { strategy: { const: 'unscheduled' }, name: { type: 'string' } } },
          ],
        } };
      }
      if (name === 'service_equipment_scheduled' || name === 'vessel_scheduled') {
        return { id, ok: true, status: 200, json: { title: 'ServiceEquipmentScheduled', type: 'object', properties: { strategy: { const: 'scheduled' }, name: { type: 'string' } } } };
      }
      if (name === 'service_equipment_unscheduled' || name === 'vessel_unscheduled') {
        return { id, ok: true, status: 200, json: { title: 'ServiceEquipmentUnscheduled', type: 'object', properties: { strategy: { const: 'unscheduled' }, name: { type: 'string' } } } };
      }
      return { id, ok: false, status: 404, json: { error: 'Unknown schema' } };
    }

    // Client-scoped helpers
    const refreshMatch = path.match(/^\/api\/(.+?)\/refresh$/);
    const filesMatch = path.match(/^\/api\/(.+?)\/library\/files$/);
    const configMatch = path.match(/^\/api\/(.+?)\/config$/);
    const fileMatch = path.match(/^\/api\/(.+?)\/library\/file(.*)$/);
    const saveLibMatch = path.match(/^\/api\/(.+?)\/library\/save$/);
    const loadSavedMatch = path.match(/^\/api\/(.+?)\/saved\/load$/);
    const simulateSyncMatch = path.match(/^\/api\/(.+?)\/simulate$/);
    const simulateTriggerMatch = path.match(/^\/api\/(.+?)\/simulate\/trigger$/);
    const simulateStatusMatch = path.match(/^\/api\/simulate\/status\/(.+)$/);

    // Simulation handlers
    if (simulateSyncMatch && method === 'POST') {
      const cid = simulateSyncMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);
      // Produce deterministic mock results and update results files
      const result = runMockSimulation(store);
      return { id, ok: true, status: 200, json: { status: 'finished', results: result, files: scanFiles(store) } };
    }

    if (simulateTriggerMatch && method === 'POST') {
      const cid = simulateTriggerMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const taskId = `task-${Math.random().toString(36).slice(2, 10)}`;
      tasks.set(taskId, { clientId: cid, status: 'running' });
      // Complete asynchronously
      setTimeout(() => {
        const store = ensureClientStore(cid);
        const result = runMockSimulation(store);
        tasks.set(taskId, { clientId: cid, status: 'finished', result });
      }, 1000);
      return { id, ok: true, status: 200, json: { task_id: taskId, status: 'running' } };
    }

    if (simulateStatusMatch && method === 'GET') {
      const taskId = simulateStatusMatch[1];
      const t = tasks.get(taskId);
      if (!t) {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'unknown' } };
      }
      if (t.status === 'finished') {
        const store = ensureClientStore(t.clientId);
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'finished', result: t.result, files: scanFiles(store) } };
      } else {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'running' } };
      }
    }

    if (refreshMatch && method === 'GET') {
      const cid = refreshMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);
      return { id, ok: true, status: 200, json: { files: scanFiles(store), config: getConfig(store), saved: Array.from(savedLibraries) } };
    }

    if (filesMatch && method === 'GET') {
      const cid = filesMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);
      return { id, ok: true, status: 200, json: scanFiles(store) };
    }

    if (configMatch && method === 'GET') {
      const cid = configMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);
      return { id, ok: true, status: 200, json: getConfig(store) };
    }

    if (fileMatch) {
      const cid = fileMatch[1];
      const query = new URLSearchParams((fileMatch[2] || '').replace(/^\?/, ''));
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);

      if (method === 'GET') {
        const p = query.get('path');
        const raw = (query.get('raw') || 'false').toLowerCase() === 'true';
        if (!p || !store.has(p)) {
          return { id, ok: false, status: 404, json: { error: 'File not found' } };
        }
        const entry = store.get(p)!;
        const ext = p.toLowerCase();
        if (raw) {
          if (entry.kind === 'binary') {
            return { id, ok: true, status: 200, json: { file: p, data_b64: String(entry.data), mime: entry.mime || 'application/octet-stream', raw: true } };
          } else {
            const mime = entry.mime || (ext.endsWith('.html') ? 'text/html' : 'text/plain');
            const data = entry.kind === 'yaml' ? JSON.stringify(entry.data, null, 2) : String(entry.data);
            return { id, ok: true, status: 200, json: { file: p, data, mime, raw: true } };
          }
        } else {
          if (entry.kind === 'yaml') {
            return { id, ok: true, status: 200, json: { file: p, data: entry.data } };
          } else if (ext.endsWith('.csv') || ext.endsWith('.html')) {
            return { id, ok: true, status: 200, json: { file: p, data: String(entry.data) } };
          } else {
            // default parsed as string
            return { id, ok: true, status: 200, json: { file: p, data: String(entry.data) } };
          }
        }
        
      }

      if (method === 'PUT' || method === 'POST') {
        const { file_path, content } = (msg.body || {}) as { file_path?: string; content?: any };
        if (!file_path) {
          return { id, ok: false, status: 400, json: { error: 'Missing file_path' } };
        }
        const lf = file_path.toLowerCase();
        let kind: FileEntry['kind'] = 'text';
        let mime: string | undefined;
        if (lf.endsWith('.yaml') || lf.endsWith('.yml')) kind = 'yaml';
        else if (lf.endsWith('.html')) { kind = 'text'; mime = 'text/html'; }
        else if (lf.endsWith('.csv')) { kind = 'text'; mime = 'text/csv'; }
        else if (lf.endsWith('.png')) { kind = 'binary'; mime = 'image/png'; }
        store.set(file_path, { kind, mime, data: content ?? '' });
        return { id, ok: true, status: 200, json: { ok: true, files: scanFiles(store) } };
      }

      if (method === 'DELETE') {
        const fp = query.get('file_path');
        if (!fp || !store.has(fp)) {
          return { id, ok: true, status: 200, json: { ok: true, files: scanFiles(store) } };
        }
        store.delete(fp);
        return { id, ok: true, status: 200, json: { ok: true, files: scanFiles(store) } };
      }
    }

    if (saveLibMatch && method === 'POST') {
      const cid = saveLibMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const project_name = String((msg.body?.project_name ?? '').toString() || 'project');
      savedLibraries.add(project_name);
      return { id, ok: true, status: 200, json: { ok: true, message: `Saved ${project_name}` } };
    }

    if (loadSavedMatch && method === 'POST') {
      const cid = loadSavedMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const name = String(msg.body?.name || 'dinwoodie_mock');
      const store = templateLibrary(name);
      clientStores.set(cid, store);
      return { id, ok: true, status: 200, json: { ok: true, message: `Loaded ${name}`, files: scanFiles(store) } };
    }

    // Not implemented yet
    return { id: msg.id, ok: false, status: 501, error: `Not implemented in mock worker: ${method} ${path}` };
  } catch (e: any) {
    return { id: msg.id, ok: false, status: 500, error: String(e?.message || e) };
  }
}

// Web Worker event bridge
self.addEventListener('message', async (evt: MessageEvent<WorkerRequest>) => {
  const msg = evt.data;
  if (!msg || !msg.id) return;
  const res = await handleWorkerRequest(msg);
  (self as any).postMessage(res);
});

// Create/update results files and return a mock result payload
function runMockSimulation(store: Map<string, FileEntry>) {
  // Read some inputs to influence results
  const base = store.get('project\\config\\base.yaml');
  const nTurbines = Number((base && base.kind === 'yaml' && base.data?.parameters?.turbines) || 5);
  const energy = 2500 * nTurbines; // MWh, mock scaling
  const summaryPath = 'results\\summary.yaml';
  const summary: any = {
    summary: 'Mock simulation complete',
    finished_at: new Date().toISOString(),
    energy_mwh: energy,
    task: 'mock',
  };
  store.set(summaryPath, { kind: 'yaml', data: summary });
  // Create a results CSV
  const resCsv = 'metric,value\nenergy_mwh,' + energy + '\n';
  store.set('results\\metrics.csv', { kind: 'text', mime: 'text/csv', data: resCsv });
  // Update HTML report with value
  store.set('results\\report.html', {
    kind: 'text',
    mime: 'text/html',
    data: `<!doctype html><html><head><meta charset="utf-8"><title>Mock Report</title></head><body><h1>Mock Report</h1><p>Energy (MWh): ${energy}</p></body></html>`,
  });
  return { ok: true, energy_mwh: energy };
}
