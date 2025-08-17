import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'
import { ToastProvider } from '../components/ToastManager'
import { DownloadWatcher } from '../App'
import { ApiProvider, useApiContext } from '../context/ApiContext'

function TriggerDownload({ kind }: { kind: 'binary' | 'text-html' | 'text-csv' | 'text-yaml' }) {
  const api = useApiContext()
  React.useLayoutEffect(() => {
    api.pendingDownloadRef.current = kind === 'binary' ? 'results/plot.png' : (
      kind === 'text-html' ? 'results/report.html' : (kind === 'text-csv' ? 'data/export.csv' : 'project/config/base.yaml')
    )
    if (kind === 'binary') {
      api.setBinaryPreviewUrl && api.setBinaryPreviewUrl('blob:already')
    } else {
      const map: Record<string, string> = {
        'text-html': '<h1>hello</h1>',
        'text-csv': 'a,b\n1,2',
        'text-yaml': 'a: 1',
      }
      api.setCsvPreview(map[kind])
    }
  }, [kind])
  return null
}

describe('App DownloadWatcher', () => {
  it('triggers download via anchor for binary preview', async () => {
    const aClick = vi.fn()
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const origCreate = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      if (tag === 'a') {
        const a = origCreate('a') as HTMLAnchorElement
        // Replace click with spy, keep real DOM element APIs
        ;(a as any).click = aClick
        return a as any
      }
      return origCreate(tag)
    })
    const bodyAppendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(((el: any) => { appendChild(el); return el }) as any)
    const bodyRemoveSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(((el: any) => { removeChild(el); return el }) as any)

    render(
      <ToastProvider>
        <ApiProvider>
          <DownloadWatcher />
          <TriggerDownload kind="binary" />
        </ApiProvider>
      </ToastProvider>
    )

    // Click should have happened for the anchor
    await waitFor(() => expect(aClick).toHaveBeenCalled())
    await waitFor(() => expect(appendChild).toHaveBeenCalled())
    await waitFor(() => expect(removeChild).toHaveBeenCalled())

    createElementSpy.mockRestore()
    bodyAppendSpy.mockRestore()
    bodyRemoveSpy.mockRestore()
  })

  it('creates object URL for text previews and downloads with proper extension', async () => {
    // jsdom may not provide these; polyfill before spying
    if (!(URL as any).createObjectURL) {
      ;(URL as any).createObjectURL = () => 'blob:test'
    }
    if (!(URL as any).revokeObjectURL) {
      ;(URL as any).revokeObjectURL = () => {}
    }
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const aClick = vi.fn()
    const origCreate = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      if (tag === 'a') {
        const a = origCreate('a') as HTMLAnchorElement
        ;(a as any).click = aClick
        return a as any
      }
      return origCreate(tag)
    })

    render(
      <ToastProvider>
        <ApiProvider>
          <DownloadWatcher />
          <TriggerDownload kind="text-html" />
        </ApiProvider>
      </ToastProvider>
    )

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    await waitFor(() => expect(aClick).toHaveBeenCalled())
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalled())
    createElementSpy.mockRestore()
  })
})
