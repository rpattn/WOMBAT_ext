import './App.css';
import { Routes, Route } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import { ApiProvider, useApiContext } from './context/ApiContext';
import Splash from './pages/Splash.tsx';

const SimulationManager = lazy(() => import('./pages/SimulationManager'));
const Results = lazy(() => import('./pages/Results'));
const ThemeSelector = lazy(() => import('./components/ThemeSelector'));
const ResultsCompare = lazy(() => import('./pages/ResultsCompare.tsx'));
const Gantt = lazy(() => import('./pages/Gantt.tsx'));
const LayoutMap = lazy(() => import('./pages/LayoutMap.tsx'));
const Operations = lazy(() => import('./pages/Operations.tsx'));
const ConnectionManager = lazy(() => import('./pages/ConnectionManager'));

// Guard to avoid double auto-init under React StrictMode in development
let __appAutoInitDone = false;

function AppAutoInit() {
  const { sessionId, initSession } = useApiContext();
  useEffect(() => {
    if (__appAutoInitDone) return;
    __appAutoInitDone = true;
    if (!sessionId) {
      void initSession();
    }
  }, [sessionId, initSession]);
  return null;
}

export function DownloadWatcher() {
  const { pendingDownloadRef, binaryPreviewUrl, csvPreview } = useApiContext();

  useEffect(() => {
    const path = pendingDownloadRef.current;
    if (!path) return;

    const filename = path.split('\\').pop() || 'download';
    const lower = filename.toLowerCase();

    const triggerDownload = (url: string, name: string) => {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // no-op
      }
    };

    if (binaryPreviewUrl) {
      // Use object URL for binary data (e.g., PNG)
      triggerDownload(binaryPreviewUrl, filename);
      pendingDownloadRef.current = null;
      return;
    }

    if (typeof csvPreview === 'string') {
      // Text content (html, csv, yaml)
      let type = 'text/plain;charset=utf-8';
      if (lower.endsWith('.html')) type = 'text/html;charset=utf-8';
      else if (lower.endsWith('.csv')) type = 'text/csv;charset=utf-8';
      else if (lower.endsWith('.yaml') || lower.endsWith('.yml')) type = 'application/x-yaml;charset=utf-8';

      try {
        const blob = new Blob([csvPreview], { type });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch {
        // ignore
      }
      pendingDownloadRef.current = null;
    }
  }, [binaryPreviewUrl, csvPreview, pendingDownloadRef]);

  return null;
}

export default function App() {
  return (
    <ApiProvider>
      <AppAutoInit />
      <DownloadWatcher />
      <Navbar />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/sim" element={<SimulationManager />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/compare" element={<ResultsCompare />} />
          <Route path="/results/operations" element={<Operations />} />
          <Route path="/results/gantt" element={<Gantt />} />
          <Route path="/simulation/layout" element={<LayoutMap />} />
          <Route path="/connect" element={<ConnectionManager />} />
        </Routes>
      </Suspense>
      {/* Global theme selector and sidebar toggle */}
      <div className="app-container app-full" style={{minHeight: '0px'}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Suspense fallback={null}>
            <ThemeSelector style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, padding: '0px' }} />
          </Suspense>
          <button
            className="btn"
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
            onClick={() => { try { window.dispatchEvent(new Event('wombat:toggle-sidebar')) } catch {} }}
            style={{ marginLeft: 'auto' }}
          >Toggle Sidebar</button>
        </div>
      </div>
    </ApiProvider>
  );
}

