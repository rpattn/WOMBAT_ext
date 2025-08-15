// Vitest setup: jsdom, jest-dom matchers, and global mocks
import '@testing-library/jest-dom';

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

// Basic WebSocket mock for jsdom environment
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public sent: any[] = [];
  public url: string;
  public onopen: ((ev: Event) => any) | null = null;
  public onmessage: ((ev: MessageEvent) => any) | null = null;
  public onerror: ((ev: Event) => any) | null = null;
  public onclose: ((ev: CloseEvent) => any) | null = null;

  constructor(url: string) {
    this.url = url;
    // Track instances globally for tests
    (globalThis as any).__wsInstances ??= [];
    (globalThis as any).__wsInstances.push(this);
    // Simulate async open
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    });
  }

  send(data: any) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    this.sent.push(data);
  }

  receive(data: any) {
    const evt = new MessageEvent('message', { data });
    this.onmessage?.(evt as any);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

// Attach to global
// @ts-expect-error override for tests
global.WebSocket = MockWebSocket as any;

// Provide env var used by WebSocketClient fallback
// @ts-expect-error process-like env for Vite tests
import.meta.env = { ...(import.meta as any).env, VITE_WS_URL: 'ws://localhost:1234/ws' };
