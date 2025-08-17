import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ApiProvider, useApiContext } from '../context/ApiContext'
import { ToastProvider } from '../components/ToastManager'

function Harness() {
  const api = useApiContext()
  return (
    <div>
      <button onClick={api.initSession}>init</button>
      <div data-testid="sid">{api.sessionId || ''}</div>
      <button onClick={api.fetchSavedLibraries}>fetchSaved</button>
      <button onClick={api.fetchLibraryFiles}>fetchFiles</button>
      <button onClick={api.getConfig}>getConfig</button>
      <button onClick={() => api.addOrReplaceFile('project\\config\\new.yaml', { a: 1 })}>addFile</button>
      <button onClick={() => api.deleteFile('project\\config\\new.yaml')}>delFile</button>
      <button onClick={() => api.saveLibrary('example')}>saveLib</button>
      <button onClick={() => api.loadSaved('example')}>loadSaved</button>
      <button onClick={() => api.deleteSaved('example')}>deleteSaved</button>
      <div data-testid="saved">{(api.savedLibraries || []).join(',')}</div>
      <div data-testid="files">{String(!!api.libraryFiles)}</div>
      <div data-testid="cfg">{String(Object.keys(api.configData || {}).length > 0)}</div>
      <div data-testid="sel">{api.selectedFile}</div>
    </div>
  )
}

describe('useLibrary actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Force server fetches to fail to exercise worker fallbacks
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })) as any)
  })

  it('covers saved libraries, files, config, and file ops via worker fallback', async () => {
    render(
      <ToastProvider>
        <ApiProvider>
          <Harness />
        </ApiProvider>
      </ToastProvider>
    )

    // init session -> mock-*
    screen.getByText('init').click()
    await waitFor(() => expect(screen.getByTestId('sid').textContent).toMatch(/^mock-/))

    // fetch saved (initial mock list)
    screen.getByText('fetchSaved').click()
    await waitFor(() => expect(screen.getByTestId('saved').textContent).toMatch(/dinwoodie_/))

    // fetch files
    screen.getByText('fetchFiles').click()
    await waitFor(() => expect(screen.getByTestId('files').textContent).toBe('true'))

    // get config
    screen.getByText('getConfig').click()
    await waitFor(() => expect(screen.getByTestId('cfg').textContent).toBe('true'))

    // add file -> should not throw and files truthy remains
    screen.getByText('addFile').click()
    await waitFor(() => expect(screen.getByTestId('files').textContent).toBe('true'))

    // delete file
    screen.getByText('delFile').click()
    await waitFor(() => expect(screen.getByTestId('files').textContent).toBe('true'))

    // save library (also refresh saved) -> adds 'example'
    screen.getByText('saveLib').click()
    await waitFor(() => expect(screen.getByTestId('saved').textContent).toContain('example'))

    // load saved -> selects base.yaml and reads it
    screen.getByText('loadSaved').click()
    await waitFor(() => expect(screen.getByTestId('sel').textContent).toBe('project\\config\\base.yaml'))

    // delete saved -> removed from list
    screen.getByText('deleteSaved').click()
    await waitFor(() => expect(screen.getByTestId('saved').textContent).not.toContain('example'))
  })
})
