import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiProvider, useApiContext } from '../context/ApiContext'
import { ToastProvider } from '../components/ToastManager'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

function TempHarness() {
  const api = useApiContext()
  return (
    <div>
      <button onClick={api.initSession}>init</button>
      <div data-testid="sid">{api.sessionId || ''}</div>
      <button onClick={async () => {
        const ok = await api.clearClientTemp()
        ;(window as any).__ok = ok
      }}>clearClientTemp</button>
      <button onClick={async () => {
        const c = await api.sweepTemp()
        ;(window as any).__count1 = c
      }}>sweepTemp</button>
      <button onClick={async () => {
        const c = await api.sweepTempAll()
        ;(window as any).__count2 = c
      }}>sweepTempAll</button>
    </div>
  )
}

describe('useTemp hook', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    ;(globalThis as any).fetch = vi.fn(async (url: string, opts?: any) => {
      const u = String(url)
      if (u.includes('/api/session') && (!opts || opts.method === 'POST')) {
        return new Response(JSON.stringify({ client_id: 'mock-xyz' }), { status: 200 })
      }
      if (u.endsWith('/temp') && opts?.method === 'DELETE') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (u.endsWith('/temp/sweep') && opts?.method === 'POST') {
        return new Response(JSON.stringify({ removed: ['a', 'b'] }), { status: 200 })
      }
      if (u.endsWith('/temp/sweep_all') && opts?.method === 'POST') {
        return new Response(JSON.stringify({ removed: ['a'] }), { status: 200 })
      }
      // default
      return new Response('not found', { status: 404 })
    })
  })
  afterEach(() => {
    ;(globalThis as any).fetch = realFetch
  })

  it('performs clearClientTemp, sweepTemp, sweepTempAll', async () => {
    render(
      <ToastProvider>
        <ApiProvider>
          <TempHarness />
        </ApiProvider>
      </ToastProvider>
    )
    // init
    fireEvent.click(screen.getByText('init'))
    await waitFor(() => expect(screen.getByTestId('sid').textContent).toMatch(/^mock-/))
    // clear
    await (async () => fireEvent.click(screen.getByText('clearClientTemp')))()
    await waitFor(() => expect((window as any).__ok).toBe(true))
    // sweep
    await (async () => fireEvent.click(screen.getByText('sweepTemp')))()
    await waitFor(() => expect((window as any).__count1).toBe(2))
    // sweep all
    await (async () => fireEvent.click(screen.getByText('sweepTempAll')))()
    await waitFor(() => expect((window as any).__count2).toBe(1))
  })
})
