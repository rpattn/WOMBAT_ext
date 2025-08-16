import './App.css';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import SimulationManager from './pages/SimulationManager';
import Results from './pages/Results';
import ThemeSelector from './components/ThemeSelector';
import { ApiProvider } from './context/ApiContext';
import RestClient from './components/RestClient';

export default function App() {
  const { pathname } = useLocation();
  return (
    <ApiProvider>
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
