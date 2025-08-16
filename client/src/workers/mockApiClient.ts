// Client-side helper to interact with mockApiWorker
// Provides request/response correlation and startup.

import type { WorkerRequest, WorkerResponse } from './mockApiWorker';

let worker: Worker | null = null;
const pending = new Map<string, { resolve: (v: WorkerResponse) => void; reject: (e: any) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./mockApiWorker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (evt: MessageEvent<WorkerResponse>) => {
    const res = evt.data;
    const entry = pending.get(res.id);
    if (!entry) return;
    pending.delete(res.id);
    entry.resolve(res);
  });
  worker.addEventListener('error', (e) => {
    // Reject all pending on worker error
    const err = e instanceof Error ? e : new Error('Mock API worker error');
    for (const [, p] of pending) p.reject(err);
    pending.clear();
  });
  return worker;
}

function requestId(): string {
  return 'req-' + Math.random().toString(36).slice(2, 10);
}

export async function mockApiRequest(method: string, path: string, body?: any): Promise<WorkerResponse> {
  const w = ensureWorker();
  const id = requestId();
  const msg: WorkerRequest = { id, method: method.toUpperCase(), path, body };
  const p = new Promise<WorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // Add a timeout to avoid hanging forever
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Mock API timeout for ${method} ${path}`));
      }
    }, 10000);
  });
  w.postMessage(msg);
  return p;
}

export function startMockApi(): void {
  ensureWorker();
}
