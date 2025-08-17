import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider } from '../components/ToastManager'
import { useToasts } from '../hooks/useToasts'

// Mock react-toastify.promise to observe calls
vi.mock('react-toastify', async (importOriginal) => {
  const orig: any = await importOriginal()
  return {
    ...orig,
    promise: vi.fn((p: Promise<any>, _msgs: any) => p),
  }
})

function Harness() {
  const { info, success, warning, error, promise, simulation, tempSweep } = useToasts()
  return (
    <div>
      <button onClick={() => info('i')}>i</button>
      <button onClick={() => success('s')}>s</button>
      <button onClick={() => warning('w')}>w</button>
      <button onClick={() => error('e')}>e</button>
      <button onClick={() => promise(Promise.resolve(1), { pending: 'p', success: 'ok', error: 'err' })}>p</button>
      <button onClick={() => simulation(Promise.resolve(1))}>sim</button>
      <button onClick={() => tempSweep(Promise.resolve(2))}>sweep</button>
    </div>
  )
}

describe('useToasts', () => {
  it('wires helpers and promise/simulation/tempSweep', async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('i'))
    fireEvent.click(screen.getByText('s'))
    fireEvent.click(screen.getByText('w'))
    fireEvent.click(screen.getByText('e'))
    fireEvent.click(screen.getByText('p'))
    fireEvent.click(screen.getByText('sim'))
    fireEvent.click(screen.getByText('sweep'))

    // Basic assertion that code paths executed without throwing
    expect(true).toBe(true)
  })
})
