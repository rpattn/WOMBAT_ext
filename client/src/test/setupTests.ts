// Vitest setup: jsdom, jest-dom matchers, and global mocks
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill matchMedia for jsdom
if (typeof window !== 'undefined' && (typeof window.matchMedia !== 'function')) {
  (window as any).matchMedia = (query: string) => {
    let listeners: Array<(e: MediaQueryListEvent) => void> = [];
    const mql: MediaQueryList = {
      media: query,
      matches: false,
      onchange: null,
      addListener: (cb: (e: MediaQueryListEvent) => void) => {
        listeners.push(cb);
      },
      removeListener: (cb: (e: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: (_ev: Event) => true,
    } as any;
    return mql;
  };
}

// Default REST fetch mock. Individual tests can override per-call expectations.
const defaultFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof input === 'string' ? input : (input as URL).toString());
  const method = (init?.method || 'GET').toUpperCase();
  const ok = (data: any) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  // Minimal stubs
  if (url.endsWith('/api/session') && method === 'POST') {
    return ok({ client_id: 'test-session-1234' });
  }
  if (/\/api\/[^/]+\/refresh$/.test(url) && method === 'GET') {
    return ok({ files: { yaml_files: [], csv_files: [], total_files: 0 }, config: {}, saved: [] });
  }
  if (/\/api\/[^/]+\/library\/files$/.test(url) && method === 'GET') {
    return ok({ yaml_files: ['project/config/base.yaml'], csv_files: ['results/summary.csv'], total_files: 2 });
  }
  if (/\/api\/saved$/.test(url) && method === 'GET') {
    return ok({ dirs: [] });
  }
  if (/\/api\/[^/]+\/config$/.test(url) && method === 'GET') {
    return ok({ hello: 'world' });
  }
  if (/\/api\/[^/]+\/simulate$/.test(url) && method === 'POST') {
    return ok({ status: 'finished', results: {}, files: { yaml_files: [], csv_files: [], total_files: 0 } });
  }
  if (/\/api\/[^/]+\/library\/file$/.test(url)) {
    return ok({ file: 'project/config/base.yaml', data: { hello: 'world' } });
  }
  return ok({});
});

// Set global fetch for tests (cast to any to satisfy TS in jsdom/node)
(globalThis as any).fetch = defaultFetch;

// Provide env var used by REST client
// @ts-expect-error process-like env for Vite tests
import.meta.env = { ...(import.meta as any).env, VITE_API_URL: 'http://127.0.0.1:8000/api' };
