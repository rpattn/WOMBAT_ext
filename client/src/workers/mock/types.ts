// Types shared across mock worker modules
export type WorkerRequest = {
  id: string;
  method: string;
  path: string;
  body?: any;
};

export type WorkerResponse = {
  id: string;
  ok: boolean;
  status: number;
  json?: any;
  error?: string;
};

export type FileEntry = { kind: 'text' | 'yaml' | 'binary'; mime?: string; data: any };

export type Progress = { now: number; percent?: number | null; message?: string };
export type Task = { clientId: string; status: 'running' | 'finished' | 'failed' | 'unknown'; result?: any; progress?: Progress; timerId?: any; startedAt?: number };
