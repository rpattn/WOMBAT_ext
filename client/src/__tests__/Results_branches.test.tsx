import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ApiProvider, useApiContext } from '../context/ApiContext'
import Results from '../pages/Results'
import { ToastProvider } from '../components/ToastManager'

function SetupAndRender({ kind }: { kind: 'html' | 'png' }) {
  const api = useApiContext()
  // Set up initial state for branch rendering
  React.useLayoutEffect(() => {
    // Ensure we don't trigger network calls
    api.setLibraryFiles({ yaml_files: [], csv_files: [], html_files: kind === 'html' ? ['results\\report.html'] : [], png_files: kind === 'png' ? ['results\\plot.png'] : [], total_files: 1 })
    if (kind === 'html') {
      api.setSelectedFile('results\\report.html')
      api.setCsvPreview('<!doctype html><html><body><h1>Doc</h1></body></html>')
    } else {
      api.setSelectedFile('results\\plot.png')
      api.setBinaryPreviewUrl && api.setBinaryPreviewUrl('blob:mock-url')
    }
  }, [kind])
  return <Results />
}

describe('Results page conditional rendering', () => {
  beforeEach(() => {
    // Reset DOM state
    document.body.innerHTML = ''
  })

  it('renders HTML branch with iframe', async () => {
    render(
      <ToastProvider>
        <ApiProvider>
          <SetupAndRender kind="html" />
        </ApiProvider>
      </ToastProvider>
    )
    // iframe is rendered with title of the selected file
    const iframe = await screen.findByTitle('results\\report.html')
    expect(iframe.tagName.toLowerCase()).toBe('iframe')
  })

  it('renders PNG branch with image', async () => {
    render(
      <ToastProvider>
        <ApiProvider>
          <SetupAndRender kind="png" />
        </ApiProvider>
      </ToastProvider>
    )
    const img = await screen.findByAltText(/Image preview: results\\plot\.png/i)
    expect((img as HTMLImageElement).src).toContain('blob:mock-url')
  })
})
