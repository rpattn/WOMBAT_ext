import type { WorkerRequest, WorkerResponse, FileEntry, Progress } from './types';
import { activeClients, clientStores, ensureClientStore, progressTimers, savedLibraries, tasks, templateLibrary } from './state';
import { getConfig, scanFiles } from './files';
import { runMockSimulation } from './simulation';
import { runMockOrbitSimulation } from './orbit';

function randomId(): string {
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

    // Read-only access to saved library contents (no session load)
    const savedFilesMatch = path.match(/^\/api\/saved\/([^/]+)\/files$/);
    if (savedFilesMatch && method === 'GET') {
      const name = decodeURIComponent(savedFilesMatch[1]);
      const store = templateLibrary(name);
      return { id, ok: true, status: 200, json: { files: scanFiles(store) } };
    }

    const savedFileMatch = path.match(/^\/api\/saved\/([^/]+)\/file(.*)$/);
    if (savedFileMatch && method === 'GET') {
      const name = decodeURIComponent(savedFileMatch[1]);
      const query = new URLSearchParams((savedFileMatch[2] || '').replace(/^\?/, ''));
      const inner = (query.get('path') || '').toString();
      const raw = (query.get('raw') || 'false').toLowerCase() === 'true';
      const store = templateLibrary(name);
      const candidates = [inner, inner.replace(/\//g, '\\')];
      let key = candidates.find((p) => store.has(p));
      if (!key) {
        return { id, ok: false, status: 404, json: { error: 'File not found' } };
      }
      const entry = store.get(key)!;
      const ext = key.toLowerCase();
      if (raw) {
        if (entry.kind === 'binary') {
          return { id, ok: true, status: 200, json: { file: key, data_b64: String(entry.data), mime: entry.mime || 'application/octet-stream', raw: true } };
        } else {
          const mime = entry.mime || (ext.endsWith('.html') ? 'text/html' : 'text/plain');
          const data = entry.kind === 'yaml' ? JSON.stringify(entry.data, null, 2) : String(entry.data);
          return { id, ok: true, status: 200, json: { file: key, data, mime, raw: true } };
        }
      } else {
        if (entry.kind === 'yaml') {
          return { id, ok: true, status: 200, json: { file: key, data: entry.data } };
        } else if (ext.endsWith('.csv') || ext.endsWith('.html')) {
          return { id, ok: true, status: 200, json: { file: key, data: String(entry.data) } };
        } else {
          return { id, ok: true, status: 200, json: { file: key, data: String(entry.data) } };
        }
      }
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
    // ORBIT endpoints
    const orbitSimSyncMatch = path.match(/^\/api\/(.+?)\/orbit\/simulate(?:\?.*)?$/);
    const orbitSimTriggerMatch = path.match(/^\/api\/(.+?)\/orbit\/simulate\/trigger(?:\?.*)?$/);
    const orbitSimStatusMatch = path.match(/^\/api\/orbit\/simulate\/status\/(.+)$/);
    
    // Simulation handlers
    if (simulateSyncMatch && method === 'POST') {
      const cid = simulateSyncMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);
      const result = runMockSimulation(store);
      return { id, ok: true, status: 200, json: { status: 'finished', results: result, files: scanFiles(store) } };
    }

    // ORBIT sync simulate (mirrors regular simulate)
    if (orbitSimSyncMatch && method === 'POST') {
      const cid = orbitSimSyncMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const store = ensureClientStore(cid);
      // Optional config path via query string
      const url = new URL('http://x' + path);
      const configPath = url.searchParams.get('config') || undefined;
      const result = runMockOrbitSimulation(store, { configPath });
      return { id, ok: true, status: 200, json: { status: 'finished', results: result, files: scanFiles(store) } };
    }

    if (simulateTriggerMatch && !orbitSimTriggerMatch && method === 'POST') {
      const cid = simulateTriggerMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const taskId = `task-${Math.random().toString(36).slice(2, 10)}`;
      const startedAt = Date.now();
      const initialProgress: Progress = { now: startedAt, percent: 0, message: 'starting' };
      tasks.set(taskId, { clientId: cid, status: 'running', progress: initialProgress, startedAt });
      const tickMs = 500;
      let percent = 0;
      let phase: 'starting' | 'simulating' | 'finalizing' = 'starting';
      const timerId = setInterval(() => {
        const t = tasks.get(taskId);
        if (!t || t.status !== 'running') {
          clearInterval(timerId);
          progressTimers.delete(taskId);
          return;
        }
        if (percent < 5) {
          phase = 'starting';
          percent += 1.5;
        } else if (percent < 92) {
          phase = 'simulating';
          percent += Math.max(0.8, 5 - (percent / 25));
        } else if (percent < 98) {
          phase = 'finalizing';
          percent += 0.5;
        } else {
          phase = 'finalizing';
          percent = 98;
        }
        t.progress = { now: Date.now(), percent: Math.min(98, Math.round(percent * 10) / 10), message: phase };
        tasks.set(taskId, t);
      }, tickMs);
      progressTimers.set(taskId, timerId);

      setTimeout(() => {
        try {
          const store = ensureClientStore(cid);
          const result = runMockSimulation(store);
          const t = tasks.get(taskId);
          if (t) {
            if (progressTimers.has(taskId)) {
              clearInterval(progressTimers.get(taskId));
              progressTimers.delete(taskId);
            }
            t.status = 'finished';
            t.result = result;
            t.progress = { now: Date.now(), percent: 100, message: 'finished' };
            tasks.set(taskId, t);
          }
        } catch {
          const t = tasks.get(taskId);
          if (t) {
            if (progressTimers.has(taskId)) {
              clearInterval(progressTimers.get(taskId));
              progressTimers.delete(taskId);
            }
            t.status = 'failed';
            t.result = { error: 'mock failure' };
            t.progress = { now: Date.now(), percent: null, message: 'failed' };
            tasks.set(taskId, t);
          }
        }
      }, 9000 + Math.floor(Math.random() * 3000));

      return { id, ok: true, status: 200, json: { task_id: taskId, status: 'running', progress: initialProgress } };
    }

    // Non-ORBIT async simulate status
    if (simulateStatusMatch && method === 'GET') {
      const taskId = simulateStatusMatch[1];
      const t = tasks.get(taskId);
      if (!t) {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'not_found' } };
      }
      if (t.status === 'finished') {
        const store = ensureClientStore(t.clientId);
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'finished', result: t.result, files: scanFiles(store), progress: t.progress || { now: Date.now(), percent: 100, message: 'finished' } } };
      } else if (t.status === 'failed') {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'failed', result: t.result, progress: t.progress || { now: Date.now(), percent: null, message: 'failed' } } };
      } else {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'running', progress: t.progress || { now: Date.now(), percent: null, message: 'running' } } };
      }
    }

    // ORBIT async trigger (mirrors regular simulate/trigger)
    if (orbitSimTriggerMatch && method === 'POST') {
      console.log('ORBIT async trigger', orbitSimTriggerMatch);
      const cid = orbitSimTriggerMatch[1];
      if (!activeClients.has(cid)) {
        return { id, ok: false, status: 404, json: { error: 'Unknown client_id' } };
      }
      const taskId = `task-${Math.random().toString(36).slice(2, 10)}`;
      const startedAt = Date.now();
      const initialProgress: Progress = { now: startedAt, percent: 0, message: 'starting' };
      tasks.set(taskId, { clientId: cid, status: 'running', progress: initialProgress, startedAt });
      const tickMs = 500;
      let percent = 0;
      let phase: 'starting' | 'simulating' | 'finalizing' = 'starting';
      const timerId = setInterval(() => {
        const t = tasks.get(taskId);
        if (!t || t.status !== 'running') {
          clearInterval(timerId);
          progressTimers.delete(taskId);
          return;
        }
        if (percent < 5) {
          phase = 'starting';
          percent += 1.5;
        } else if (percent < 92) {
          phase = 'simulating';
          percent += Math.max(0.8, 5 - (percent / 25));
        } else if (percent < 98) {
          phase = 'finalizing';
          percent += 0.5;
        } else {
          phase = 'finalizing';
          percent = 98;
        }
        t.progress = { now: Date.now(), percent: Math.min(98, Math.round(percent * 10) / 10), message: phase };
        tasks.set(taskId, t);
      }, tickMs);
      progressTimers.set(taskId, timerId);

      setTimeout(() => {
        try {
          const store = ensureClientStore(cid);
          // Read optional config path from the original request URL
          const url = new URL('http://x' + path);
          const configPath = url.searchParams.get('config') || undefined;
          console.log(configPath)
          const result = runMockOrbitSimulation(store, { configPath });
          const t = tasks.get(taskId);
          if (t) {
            if (progressTimers.has(taskId)) {
              clearInterval(progressTimers.get(taskId));
              progressTimers.delete(taskId);
            }
            t.status = 'finished';
            t.result = result;
            t.progress = { now: Date.now(), percent: 100, message: 'finished' };
            tasks.set(taskId, t);
          }
        } catch {
          console.log('runMockOrbitSimulation failed', taskId);
          const t = tasks.get(taskId);
          if (t) {
            if (progressTimers.has(taskId)) {
              clearInterval(progressTimers.get(taskId));
              progressTimers.delete(taskId);
            }
            t.status = 'failed';
            t.result = { error: 'mock failure' };
            t.progress = { now: Date.now(), percent: null, message: 'failed' };
            tasks.set(taskId, t);
          }
        }
      }, 9000 + Math.floor(Math.random() * 3000));

      console.log('runMockOrbitSimulation', taskId);

      return { id, ok: true, status: 200, json: { task_id: taskId, status: 'running', progress: initialProgress } };
    }

    if (orbitSimStatusMatch && method === 'GET') {
      const taskId = orbitSimStatusMatch[1];
      const t = tasks.get(taskId);
      if (!t) {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'not_found' } };
      }
      if (t.status === 'finished') {
        const store = ensureClientStore(t.clientId);
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'finished', result: t.result, files: scanFiles(store), progress: t.progress || { now: Date.now(), percent: 100, message: 'finished' } } };
      } else if (t.status === 'failed') {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'failed', result: t.result, progress: t.progress || { now: Date.now(), percent: null, message: 'failed' } } };
      } else {
        return { id, ok: true, status: 200, json: { task_id: taskId, status: 'running', progress: t.progress || { now: Date.now(), percent: null, message: 'running' } } };
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

    return { id: msg.id, ok: false, status: 501, error: `Not implemented in mock worker: ${method} ${path}` };
  } catch (e: any) {
    return { id: msg.id, ok: false, status: 500, error: String(e?.message || e) };
  }
}
