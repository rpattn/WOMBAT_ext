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

  return (<>
    <WebSocketClient onMessage={handleWebSocketMessage} onSendReady={handleSendReady} />
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleGetConfig} style={{ marginRight: '10px', padding: '8px 16px' }}>
          Get Config
        </button>
        <button onClick={handleClearTemp} style={{ marginRight: '10px', padding: '8px 16px' }}>
          Clear Temp
        </button>
      </div>
      <Settings data={configData} onChange={handleSettingsChange} onSendSettings={handleSendSettings}/>
    </div>
  </>)
}
