import { useEffect, useRef, useState } from 'react'
import './WebSocketClient.css'
import { useToast } from './ToastManager'
import { toast } from 'react-toastify'

type WebSocketClientProps = {
  initialUrl?: string
  onMessage?: (message: string) => void
  onSendReady?: (sendFunction: (message: string) => boolean) => void
}

const fallbackUrl = (import.meta as any).env?.VITE_WS_URL ?? 'ws://127.0.0.1:8000/ws'

export default function WebSocketClient({ initialUrl, onMessage, onSendReady }: WebSocketClientProps) {
  const [wsUrl, setWsUrl] = useState<string>(initialUrl ?? fallbackUrl)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [messages, setMessages] = useState<string[]>([])
  const [outgoing, setOutgoing] = useState<string>('')
  const websocketRef = useRef<WebSocket | null>(null)
  const toastApi = useToast()
  // Track a single spinner for repeated "[server] running..." updates
  const runningSpinnerRef = useRef<{ resolve?: (v?: unknown) => void; reject?: (e?: unknown) => void } | null>(null)

  const appendMessage = (msg: string) => {
    setMessages((prev) => [...prev, msg])
    // Toast selectively based on message content
    const trimmed = msg.trim()
    const lower = trimmed.toLowerCase()
    const stripPrefix = (m: string) => m.replace(/^\[[^\]]+\]\s*/, '')

    // Error messages
    if (lower.startsWith('[error]')) {
      toastApi.error(stripPrefix(trimmed) || 'An error occurred')
      return
    }

    // Connection status
    if (lower.includes('connected ->')) {
      toastApi.success('Connected to server')
      return
    }
    if (lower.includes('disconnected')) {
      toastApi.warning('Disconnected from server')
      return
    }

    // Cannot send warnings
    if (lower.includes('cannot send')) {
      toastApi.warning(stripPrefix(trimmed))
      return
    }

    // Non-JSON server messages: special-case "running..." with a promise spinner
    if (lower.startsWith('[server]')) {
      const text = stripPrefix(trimmed)
      // If it's a streaming progress like "running... 5s" -> show a single spinner (no repeated toasts)
      if (/^running\.\.\./i.test(text)) {
        if (!runningSpinnerRef.current) {
          let resolveFn!: (value?: unknown) => void
          let rejectFn!: (reason?: unknown) => void
          const p = new Promise<unknown>((resolve, reject) => {
            resolveFn = resolve
            rejectFn = reject
          })
          toast.promise(
            p,
            {
              pending: 'Simulation is running...',
              success: 'Simulation is complete',
              error: 'Simulation stopped',
            },
            { toastId: 'server-running-spinner', autoClose: 3000, closeOnClick: false, draggable: false }
          )
          runningSpinnerRef.current = { resolve: resolveFn!, reject: rejectFn! }
        }
        // Do not show an info toast for each tick
        return
      }

      // If we had a running spinner and we receive a different server message, consider it completed
      if (runningSpinnerRef.current) {
        runningSpinnerRef.current.resolve?.()
        runningSpinnerRef.current = null
      }

      if (text && !/json config received/i.test(text)) {
        toastApi.info(text)
      }
      return
    }

    // For routine client logs (e.g. sent messages), do not toast
  }

  const isJsonPayload = (str: string): boolean => {
    try {
      const parsed = JSON.parse(str)
      return typeof parsed === 'object' && parsed !== null
    } catch {
      return false
    }
  }

  const connect = () => {
    if (isConnected || websocketRef.current) {
      return
    }
    try {
      const socket = new WebSocket(wsUrl)
      websocketRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        appendMessage(`[client] connected -> ${wsUrl}`)
        // Automatically send "get_library_files" upon connection
        socket.send('get_library_files')
        appendMessage(`[client] get_library_files`)
        // Also request list of saved libraries
        const listMsg = JSON.stringify({ event: 'list_saved_libraries' })
        socket.send(listMsg)
        appendMessage(`[client] list_saved_libraries`)
        // Expose send function to parent component
        onSendReady?.(sendProgrammaticMessage)
      }

      socket.onmessage = (event: MessageEvent) => {
        // Check if the message is a JSON payload
        if (isJsonPayload(event.data)) {
          // Log JSON payloads to console instead of showing in messages
          console.log('[server JSON]', event.data)
          appendMessage('[server] JSON config received (check console)')
        } else {
          // Show non-JSON messages in the messages box
          appendMessage(`[server] ${event.data}`)
        }
        // Call the callback if provided
        onMessage?.(event.data)
      }

      socket.onerror = (event) => {
        appendMessage(`[error] ${String((event as ErrorEvent)?.message ?? 'ws error')}`)
        // Fail the running spinner if present
        if (runningSpinnerRef.current) {
          runningSpinnerRef.current.reject?.(new Error('WebSocket error'))
          runningSpinnerRef.current = null
        }
      }

      socket.onclose = () => {
        setIsConnected(false)
        appendMessage('[client] disconnected')
        websocketRef.current = null
        // Reject spinner on disconnect
        if (runningSpinnerRef.current) {
          runningSpinnerRef.current.reject?.(new Error('Disconnected'))
          runningSpinnerRef.current = null
        }
      }
    } catch (err) {
      appendMessage(`[error] ${(err as Error).message}`)
      websocketRef.current = null
      setIsConnected(false)
    }
  }

  const disconnect = () => {
    const socket = websocketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close()
    }
    websocketRef.current = null
    setIsConnected(false)
  }

  const sendMessage = () => {
    const socket = websocketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendMessage('[client] cannot send: socket not open')
      return
    }
    if (outgoing.trim().length === 0) {
      return
    }
    socket.send(outgoing)
    appendMessage(`[client] ${outgoing}`)
    setOutgoing('')
  }

  const sendProgrammaticMessage = (message: string) => {
    const socket = websocketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendMessage('[client] cannot send: socket not open')
      return false
    }
    socket.send(message)
    appendMessage(`[client] ${message}`)
    return true
  }

  useEffect(() => {
    // Auto-connect when component mounts
    connect()
  }, [])

  return (
    <div className="ws-container" style={{margin: '5px'}}>
      <div className="card ws-card" style={{margin: '5px'}}>
        <label className="ws-label">
          <span>Server WebSocket URL</span>
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="ws://127.0.0.1:8000/ws"
            className="ws-input"
          />
        </label>

        <div className="ws-row">
          <button className="btn-app btn-success" onClick={connect} disabled={isConnected}>Connect</button>
          <button className="btn-app btn-danger" onClick={disconnect} disabled={!isConnected}>Disconnect</button>
        </div>

        <div className="ws-grid">
          <span>Send a message</span>
          <div className="ws-row">
            <input
              type="text"
              value={outgoing}
              onChange={(e) => setOutgoing(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendMessage()
                }
              }}
              placeholder="hello"
              className="ws-input ws-grow"
            />
            <button className="btn-app btn-primary" onClick={sendMessage} disabled={!isConnected}>Send</button>
          </div>
        </div>

        <div className="ws-grid">
          <details>
            <summary className="ws-summary">
              Messages ({messages.length})
            </summary>
            <div className="ws-messages">
              {messages.length === 0 ? (
                <div className="ws-empty">No messages yet</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="ws-message">{m}</div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}


