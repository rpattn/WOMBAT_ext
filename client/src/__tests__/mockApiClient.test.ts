import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkerResponse } from '../workers/mockApiWorker'
import * as workerModule from '../workers/mockApiWorker'

// Helper to import fresh module each test
async function importClient() {
  const mod = await import('../workers/mockApiClient')
  return mod
}

describe('mockApiClient request paths', () => {
  const realWorker = (globalThis as any).Worker

  afterEach(() => {
    ;(globalThis as any).Worker = realWorker
    vi.restoreAllMocks()
  })

  it('falls back to direct handler when Worker is undefined', async () => {
    ;(globalThis as any).Worker = undefined
    const { mockApiRequest } = await importClient()

    const res = await mockApiRequest('POST', '/api/session')
    expect(res.ok).toBe(true)
    const cid = String(res.json?.client_id || '')
    expect(cid).toMatch(/^mock-/)

    const res2 = await mockApiRequest('GET', `/api/${cid}/refresh`)
    expect(res2.ok).toBe(true)
    expect(res2.json?.files).toBeTruthy()
  })

  it('uses Worker path when Worker is available', async () => {
    // Minimal stub Worker that routes to handleWorkerRequest and invokes message listeners
    class StubWorker {
      private listeners = new Map<string, Function[]>()
      constructor(_url: any, _opts: any) {}
      addEventListener(type: string, cb: any) {
        const arr = this.listeners.get(type) || []
        arr.push(cb)
        this.listeners.set(type, arr)
      }
      postMessage = async (msg: any) => {
        try {
          const res: WorkerResponse = await workerModule.handleWorkerRequest(msg)
          const ls = this.listeners.get('message') || []
          ls.forEach((fn) => fn({ data: res }))
        } catch (e) {
          const ls = this.listeners.get('error') || []
          ls.forEach((fn) => fn(e))
        }
      }
    }
    ;(globalThis as any).Worker = StubWorker as unknown as Worker

    const { mockApiRequest, startMockApi } = await importClient()

    // ensureWorker gets initialized
    startMockApi()

    const res = await mockApiRequest('POST', '/api/session')
    expect(res.ok).toBe(true)
    const cid = String(res.json?.client_id || '')
    expect(cid).toMatch(/^mock-/)

    const res2 = await mockApiRequest('GET', `/api/${cid}/library/files`)
    expect(res2.ok).toBe(true)
    expect(res2.json?.total_files).toBeGreaterThan(0)
  })
})
