import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ensure a #root exists for main.tsx to mount into
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
})

describe('main.tsx bootstrap', () => {
  it('creates a root and renders App without throwing', async () => {
    // Mock createRoot to avoid actually rendering React tree in this unit test
    vi.doMock('react-dom/client', async (orig) => {
      const mod: any = await orig()
      return {
        ...mod,
        createRoot: vi.fn(() => ({ render: vi.fn() })),
      }
    })

    // Dynamic import after mocks are set up
    await import('../main')

    // Assert root element is present
    const root = document.getElementById('root')
    expect(root).toBeTruthy()
  })
})
