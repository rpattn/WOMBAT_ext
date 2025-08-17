import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../components/ToastManager'
import { ApiProvider, useApiContext } from '../context/ApiContext'

function Harness() {
  const api = useApiContext()
  return (
    <div>
      <button onClick={api.initSession}>init</button>
      <button onClick={api.runSimulation}>run</button>
      <div data-testid="session">{api.sessionId || ''}</div>
      <div data-testid="total">{api.libraryFiles?.total_files ?? 0}</div>
      <div data-testid="results">{String(!!api.results)}</div>
    </div>
  )
}

describe('useSimulation worker fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Force REST simulate trigger + status to fail so we hit worker paths
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })) as any)
  })

  it('uses mock worker and sets results and files', async () => {
    render(
      <ToastProvider>
        <ApiProvider>
          <Harness />
        </ApiProvider>
      </ToastProvider>
    )

    screen.getByText('init').click()
    await waitFor(() => expect(screen.getByTestId('session').textContent).toMatch(/^mock-/))
    screen.getByText('run').click()

    await waitFor(() => expect(screen.getByTestId('results').textContent).toBe('true'), { timeout: 5000 })
    await waitFor(() => expect(Number(screen.getByTestId('total').textContent)).toBeGreaterThan(0), { timeout: 5000 })
  })
})
