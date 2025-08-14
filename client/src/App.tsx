import { useState } from 'react'
import './App.css'
import Settings from './components/SettingsEditor'
import WebSocketClient from './components/WebSocketClient'

const exampleData = {
  name: "example",
  library: "example",
  weather: "example.csv",
  service_equipment: [
  ],
  layout: "layout.csv",
  inflation_rate: 0,
  fixed_costs: "fixed_costs.yaml",
  workday_start: 7,
  workday_end: 19,
  start_year: 2003,
  end_year: 2012,
  project_capacity: 240
};

export default function App() {
  const [configData, setConfigData] = useState(exampleData);
  const [sendWebSocketMessage, setSendWebSocketMessage] = useState<((message: string) => boolean) | null>(null);

  const handleWebSocketMessage = (message: string) => {
    try {
      // Try to parse the message as JSON
      const parsedData = JSON.parse(message);
      
      // Check if the parsed data has the expected structure for config
      if (parsedData && typeof parsedData === 'object' && 
          'name' in parsedData && 'library' in parsedData) {
        console.log('Received config from WebSocket:', parsedData);
        setConfigData(parsedData);
      }
    } catch (error) {
      // If parsing fails, it's not a JSON config message - ignore it
      console.log('Non-JSON message received:', message);
    }
  };

  const handleSettingsChange = (updatedData: any) => {
    console.log('Settings changed:', updatedData);
    setConfigData(updatedData);
  };

  const handleSendReady = (sendFunction: (message: string) => boolean) => {
    setSendWebSocketMessage(() => sendFunction);
  };

  const handleSendSettings = () => {
    if (sendWebSocketMessage) {
      const settingsMessage = JSON.stringify({
        event: 'settings_update',
        data: configData
      });
      const success = sendWebSocketMessage(settingsMessage);
      if (success) {
        console.log('Settings sent to server:', configData);
      }
    }
  };

  const handleGetConfig = () => {
    if (sendWebSocketMessage) {
      const success = sendWebSocketMessage('get_config');
      if (success) {
        console.log('Requested config from server');
      }
    }
  };

  const handleClearTemp = () => {
    if (sendWebSocketMessage) {
      const success = sendWebSocketMessage('clear_temp');
      if (success) {
        console.log('Requested temp cleanup from server');
      }
    }
  };

  const handleRunSimulation = () => {
    if (sendWebSocketMessage) {
      const success = sendWebSocketMessage('run');
      if (success) {
        console.log('Started simulation run');
      }
    }
  };

  const buttonStyle = {
    padding: '10px 20px',
    marginRight: '12px',
    marginBottom: '8px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#007bff',
    color: 'white'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    color: 'white'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#dc3545',
    color: 'white'
  };

  return (<>
    <WebSocketClient onMessage={handleWebSocketMessage} onSendReady={handleSendReady} />
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: '#333' }}>Simulation Controls</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          <button onClick={handleRunSimulation} style={primaryButtonStyle}>
            🚀 Run Simulation
          </button>
          <button onClick={handleGetConfig} style={secondaryButtonStyle}>
            📋 Get Config
          </button>
          <button onClick={handleClearTemp} style={dangerButtonStyle}>
            🗑️ Clear Temp
          </button>
        </div>
      </div>
      <Settings data={configData} onChange={handleSettingsChange} onSendSettings={handleSendSettings}/>
    </div>
  </>)
}
