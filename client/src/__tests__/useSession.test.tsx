import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ToastProvider } from '../components/ToastManager'
import { useSession } from '../hooks/useSession'
import React from 'react'

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useSession>) => void }) {
  const api = useSession('http://127.0.0.1:8000/api')
  React.useEffect(() => { onReady(api) }, [api, onReady])
  return null
}

describe('useSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('requireSession throws without session; initSession sets an id; endSession clears', async () => {
    // Mock REST endpoints directly for stability
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/session') && init?.method === 'POST') {
        return new Response(JSON.stringify({ client_id: 'abc123' }), { status: 200 })
      }
      if (url.includes('/session/') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ status: 'ended' }), { status: 200 })
      }
      return new Response('not mocked', { status: 404 })
    }) as any)

    let apiRef: ReturnType<typeof useSession> | null = null
    render(
      <ToastProvider>
        <Harness onReady={(api) => { apiRef = api }} />
      </ToastProvider>
    )

    expect(apiRef).toBeTruthy()
    const api = apiRef!

    // requireSession should throw before init
    expect(() => api.requireSession()).toThrowError(/No REST session/i)

    // initSession should set some session id (REST or mock fallback)
    const id = await api.initSession()
    expect(String(id)).not.toBe('')
    // Wait for state to flush so requireSession stops throwing
    await import('@testing-library/react').then(({ waitFor }) =>
      waitFor(() => expect(() => api.requireSession()).not.toThrow())
    )
    // requireSession should now return an id equal to the stored session
    const reqId = api.requireSession()
    expect(String(reqId)).not.toBe('')

    // endSession should clear sessionId even if server delete fails
    await api.endSession()
    expect(api.sessionId).toBeNull()

    // Then calling requireSession again throws
    expect(() => api.requireSession()).toThrowError()
  })
})
