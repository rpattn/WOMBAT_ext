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

// Thin entry that re-exports types and delegates to modular handlers
export type { WorkerRequest, WorkerResponse } from './mock/types';
import type { WorkerRequest as _WorkerRequest, WorkerResponse as _WorkerResponse } from './mock/types';
import { handleWorkerRequest } from './mock/handlers';
export { handleWorkerRequest };

// Web Worker event bridge (thin)
self.addEventListener('message', async (evt: MessageEvent<_WorkerRequest>) => {
  const msg = evt.data;
  if (!msg || !(msg as any).id) return;
  const res = await handleWorkerRequest(msg as any);
  (self as any).postMessage(res as _WorkerResponse);
});
