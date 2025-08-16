import './App.css';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import SimulationManager from './pages/SimulationManager';
import Results from './pages/Results';
import ThemeSelector from './components/ThemeSelector';
import { ApiProvider, useApiContext } from './context/ApiContext';
import RestClient from './components/RestClient';

function DownloadWatcher() {
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
  const { pathname } = useLocation();
  return (
    <ApiProvider>
      <DownloadWatcher />
      <Navbar />
      {/* REST client panel */}
      <div className="app-container app-full" style={{minHeight: '0px'}}>
        <details open={pathname === '/connect'}>
          <summary style={{textAlign: 'left', padding: '0px'}}>REST Client</summary>
          <RestClient />
        </details>
      </div>
      <Routes>
        <Route path="/" element={<SimulationManager />} />
        <Route path="/results" element={<Results />} />
        <Route path="/connect" element={<></>} />
      </Routes>
      {/* Global theme selector */}
      <div className="app-container app-full" style={{minHeight: '0px'}}>
        <ThemeSelector style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, padding: '0px' }} />
      </div>
    </ApiProvider>
  );
}
