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

  return (<>
    <WebSocketClient onMessage={handleWebSocketMessage} onSendReady={handleSendReady} />
    <Settings data={configData} onChange={handleSettingsChange} onSendSettings={handleSendSettings}/>
  </>)
}
