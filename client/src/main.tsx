import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastManager'
import { BrowserRouter } from 'react-router-dom'
import { enableWorkerFetchGlobally } from './workers/workerFetch'

// Install a transparent fetch wrapper that falls back to the mock Web Worker for API calls
const DEFAULT_API = (import.meta as any).env?.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
enableWorkerFetchGlobally(DEFAULT_API)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
