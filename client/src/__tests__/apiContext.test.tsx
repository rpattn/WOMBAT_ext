import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { ApiProvider, useApiContext } from '../context/ApiContext'

function Harness() {
  const api = useApiContext()
  return (
    <div>
      <button onClick={api.initSession}>init</button>
      <div data-testid="session">{api.sessionId || ''}</div>
      <button onClick={api.fetchSavedLibraries}>saved</button>
      <div data-testid="saved">{api.savedLibraries.join(',')}</div>
      <button onClick={api.fetchLibraryFiles}>files</button>
      <div data-testid="yaml">{api.libraryFiles?.yaml_files.length ?? 0}</div>
      <button onClick={() => api.getConfig()}>config</button>
      <div data-testid="cfg">{Object.keys(api.configData || {}).length}</div>
    </div>
  )
}

describe('ApiContext', () => {
  const base = 'http://127.0.0.1:8000/api'
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      // session
      if (url === `${base}/session` && init?.method === 'POST') {
        return new Response(JSON.stringify({ client_id: 'abc123' }), { status: 200 })
      }
      if (url === `${base}/saved` && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify({ dirs: ['projA', 'projB'] }), { status: 200 })
      }
      if (url === `${base}/abc123/library/files`) {
        return new Response(JSON.stringify({ yaml_files: ['project/config/base.yaml'], csv_files: [], total_files: 1 }), { status: 200 })
      }
      if (url === `${base}/abc123/config`) {
        return new Response(JSON.stringify({ a: 1 }), { status: 200 })
      }
      return new Response('not mocked', { status: 404 })
    }) as any)
  })

  it('initializes session and fetches data', async () => {
    render(
      <ApiProvider>
        <Harness />
      </ApiProvider>
    )

    // init session
    screen.getByText('init').click()
    await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('abc123'))

    // saved
    screen.getByText('saved').click()
    await waitFor(() => expect(screen.getByTestId('saved').textContent).toContain('projA'))

    // files
    screen.getByText('files').click()
    await waitFor(() => expect(screen.getByTestId('yaml').textContent).toBe('1'))

    // config
    screen.getByText('config').click()
    await waitFor(() => expect(screen.getByTestId('cfg').textContent).toBe('1'))
  })
})
