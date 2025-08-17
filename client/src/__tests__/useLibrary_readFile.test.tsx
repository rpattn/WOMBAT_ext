import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../components/ToastManager'
import { ApiProvider, useApiContext } from '../context/ApiContext'
import React from 'react'

function Harness() {
  const api = useApiContext()
  return (
    <div>
      <button onClick={api.initSession}>init</button>
      <div data-testid="session">{api.sessionId || ''}</div>
      <button onClick={() => api.readFile('results\\plot.png', true)}>readPng</button>
      <button onClick={() => api.readFile('results\\report.html', true)}>readHtml</button>
      <button onClick={() => api.readFile('project\\config\\base.yaml', false)}>readYaml</button>
      <div data-testid="bin">{String(api.binaryPreviewUrl ?? '')}</div>
      <div data-testid="csv">{String(api.csvPreview ?? '')}</div>
      <div data-testid="cfg">{String(!!api.configData && Object.keys(api.configData).length > 0)}</div>
      <div data-testid="sel">{api.selectedFile}</div>
    </div>
  )
}

describe('useLibrary.readFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Force server fetch to fail to use worker
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })) as any)
    // jsdom doesn't implement createObjectURL; mock it
    const g: any = globalThis as any
    if (!g.URL) g.URL = {} as any
    if (!g.URL.createObjectURL) g.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = vi.fn()
  })

  it('handles binary, raw text, and yaml paths', async () => {
    render(
      <ToastProvider>
        <ApiProvider>
          <Harness />
        </ApiProvider>
      </ToastProvider>
    )

    // Init mock session
    screen.getByText('init').click()
    await waitFor(() => expect(screen.getByTestId('session').textContent).toMatch(/^mock-/))

    // Read PNG (raw binary)
    screen.getByText('readPng').click()
    await waitFor(() => expect(screen.getByTestId('bin').textContent).toBe('blob:mock-url'))

    // Read HTML (raw text)
    screen.getByText('readHtml').click()
    await waitFor(() => expect(screen.getByTestId('csv').textContent).toContain('<!doctype html>'))

    // Read YAML (parsed)
    screen.getByText('readYaml').click()
    await waitFor(() => expect(screen.getByTestId('cfg').textContent).toBe('true'))
    await waitFor(() => expect(screen.getByTestId('sel').textContent).toBe('project\\config\\base.yaml'))
  })
})
