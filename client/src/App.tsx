import './App.css';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SimulationManager from './pages/SimulationManager';
import Results from './pages/Results';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<SimulationManager />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </>
  );
}
