import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastManager'
import { BrowserRouter } from 'react-router-dom'
import { WebSocketProvider } from './context/WebSocketContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
