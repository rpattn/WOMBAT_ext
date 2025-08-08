import { useEffect, useRef, useState } from 'react'

type WebSocketClientProps = {
  initialUrl?: string
}

const fallbackUrl = (import.meta as any).env?.VITE_WS_URL ?? 'ws://127.0.0.1:8000/ws'

export default function WebSocketClient({ initialUrl }: WebSocketClientProps) {
  const [wsUrl, setWsUrl] = useState<string>(initialUrl ?? fallbackUrl)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [messages, setMessages] = useState<string[]>([])
  const [outgoing, setOutgoing] = useState<string>('')
  const websocketRef = useRef<WebSocket | null>(null)

  const appendMessage = (msg: string) =>
    setMessages((prev) => [...prev, msg])

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
      }

      socket.onmessage = (event: MessageEvent) => {
        appendMessage(`[server] ${event.data}`)
      }

      socket.onerror = (event) => {
        appendMessage(`[error] ${String((event as ErrorEvent)?.message ?? 'ws error')}`)
      }

      socket.onclose = () => {
        setIsConnected(false)
        appendMessage('[client] disconnected')
        websocketRef.current = null
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

  useEffect(() => {
    return () => {
      try {
        websocketRef.current?.close()
      } catch {}
    }
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>WebSocket Client</h1>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Server WebSocket URL</span>
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="ws://127.0.0.1:8000/ws"
            style={{ padding: '8px 10px', fontFamily: 'monospace' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={connect} disabled={isConnected}>Connect</button>
          <button onClick={disconnect} disabled={!isConnected}>Disconnect</button>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <span>Send a message</span>
          <div style={{ display: 'flex', gap: 8 }}>
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
              style={{ flex: 1, padding: '8px 10px' }}
            />
            <button onClick={sendMessage} disabled={!isConnected}>Send</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <span>Messages</span>
          <div
            style={{
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: 12,
              minHeight: 160,
              background: '#111',
              color: '#ddd',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              overflowY: 'auto',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No messages yet</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{m}</div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="read-the-docs" style={{ marginTop: 16 }}>
        Tip: Start the FastAPI server with "fastapi dev examples/api/websocket_fastapi_demo.py" and then connect.
      </p>
    </div>
  )
}


