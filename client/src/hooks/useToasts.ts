import { toast as toastify, type ToastOptions } from 'react-toastify'
import { useToast } from '../components/ToastManager'

export type PromiseMessages = {
  pending: string
  success: string
  error: string
}

export function useToasts() {
  const toast = useToast()

  const info = (msg: string, opts?: ToastOptions) => toast.info(msg, opts)
  const success = (msg: string, opts?: ToastOptions) => toast.success(msg, opts)
  const warning = (msg: string, opts?: ToastOptions) => toast.warning(msg, opts)
  const error = (msg: string, opts?: ToastOptions) => toast.error(msg, opts)

  const promise = <T,>(p: Promise<T>, messages: PromiseMessages) => {
    return toastify.promise(p, messages)
  }

  // Domain helpers
  const simulation = (p: Promise<unknown>) =>
    promise(p, {
      pending: 'Running simulation…',
      success: 'Simulation finished!',
      error: 'Simulation failed',
    })

  const tempSweep = (p: Promise<number>) => {
    info('Clearing temp folders…')
    p.then((count) => success(`Cleared ${count} temp folder(s)`)).catch(() => error('Failed to clear temp folders'))
    return p
  }

  return { info, success, warning, error, promise, simulation, tempSweep }
}
