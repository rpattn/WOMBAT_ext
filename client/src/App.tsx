import './App.css';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import SimulationManager from './pages/SimulationManager';
import Results from './pages/Results';
import WebSocketClient from './components/WebSocketClient';
import { useWebSocketContext } from './context/WebSocketContext';
import { createWebSocketMessageHandler } from './utils/websocketHandlers';
import { useToast } from './components/ToastManager';
import ThemeSelector from './components/ThemeSelector';

export default function App() {
  const ws = useWebSocketContext();
  const toast = useToast();

  const handleWebSocketMessage = createWebSocketMessageHandler({
    setConfigData: ws.setConfigData,
    setCsvPreview: ws.setCsvPreview,
    setLibraryFiles: ws.setLibraryFiles,
    setSavedLibraries: ws.setSavedLibraries,
    pendingDownloadRef: ws.pendingDownloadRef,
    onToast: (level, message) => {
      switch (level) {
        case 'success': toast.success(message); break;
        case 'warning': toast.warning(message); break;
        case 'error': toast.error(message); break;
        default: toast.info(message);
      }
    },
  });

  const onMessage = (msg: string) => {
    // Update shared state
    handleWebSocketMessage(msg);
    // Notify any page-level listeners still subscribed
    ws.notify(msg);
  };
  const { pathname } = useLocation();
  return (
    <>
      <Navbar />
      {/* Single shared WebSocket connection*/}
      <details open={pathname === '/connect'}>
        <summary style={{textAlign: 'left', padding: '0px 16px'}}>WebSocket Client</summary>
        <WebSocketClient onMessage={onMessage} onSendReady={ws.setSend} />
      </details>
      <Routes>
        <Route path="/" element={<SimulationManager />} />
        <Route path="/results" element={<Results />} />
        <Route path="/connect" element={<></>} />
      </Routes>
      {/* Global theme selector */}
      <ThemeSelector style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, padding: '8px 16px' }} />
    </>
  );
}
