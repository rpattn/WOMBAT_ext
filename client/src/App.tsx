import { useState } from 'react';
import './App.css';
import JsonEditor from './components/JsonEditor';
import WebSocketClient from './components/WebSocketClient';
import FileSelector from './components/FileSelector';

const exampleData = {
  name: "example",
  library: "example",
  weather: "example.csv",
  service_equipment: [
    "example.yaml"
  ],
  object: {
    name: "example",
    key: "example",
    value: "example"
  },
  layout: "layout.csv",
  inflation_rate: 0,
  fixed_costs: "fixed_costs.yaml",
  workday_start: 7,
  workday_end: 19,
  start_year: 2003,
  end_year: 2012,
  project_capacity: 240
};

export const example_library_structure = {
  "yaml_files": [
    "cables\\array.yaml",
    "cables\\export.yaml",
    "project\\config\\base_2yr.yaml",
    "project\\port\\base_port.yaml",
    "substations\\offshore_substation.yaml",
    "turbines\\vestas_v90.yaml",
    "vessels\\ctv1.yaml",
    "vessels\\ctv2.yaml",
    "vessels\\ctv3.yaml",
    "vessels\\ctv4.yaml",
    "vessels\\ctv5.yaml",
    "vessels\\fsv_downtime.yaml",
    "vessels\\fsv_requests.yaml",
    "vessels\\fsv_scheduled.yaml",
    "vessels\\hlv_1_scheduled.yaml",
    "vessels\\hlv_2_scheduled.yaml",
    "vessels\\hlv_3_scheduled.yaml",
    "vessels\\hlv_downtime.yaml",
    "vessels\\hlv_requests.yaml",
    "vessels\\tugboat1.yaml",
    "vessels\\tugboat2.yaml",
    "vessels\\tugboat3.yaml"
  ],
  "csv_files": [
    "project\\plant\\layout.csv",
    "turbines\\vestas_v90_power_curve.csv",
    "weather\\alpha_ventus_weather_2002_2014.csv",
    "weather\\alpha_ventus_weather_2002_2014_zeros.csv"
  ],
  "total_files": 26
} as const;

export default function App() {
  const [configData, setConfigData] = useState<typeof exampleData>(exampleData);
  const [sendWebSocketMessage, setSendWebSocketMessage] = useState<((message: string) => boolean) | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');

  const handleFileSelect = (filePath: string) => {
    console.log('Selected file:', filePath);
    setSelectedFile(filePath);
    
    // Send WebSocket message when a file is selected
    if (sendWebSocketMessage) {
      const message = JSON.stringify({
        event: 'file_select',
        data: filePath
      });
      const success = sendWebSocketMessage(message);
      if (!success) {
        console.error('Failed to send file select message');
      } else {
        console.log('Sent file select message for:', filePath);
      }
    } else {
      console.warn('WebSocket not ready to send file select message');
    }
  };

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
      if (parsedData && typeof parsedData === 'object' && 
          'event' in parsedData && parsedData.event === 'file_content') {
        console.log('Received file content from WebSocket:', parsedData);
        setConfigData(parsedData.data);
      }
    } catch (error) {
      // If parsing fails, it's not a JSON config message - ignore it
      console.log('Non-JSON message received:', message);
    }
  };

  const handleSendReady = (sendFunction: (message: string) => boolean) => {
    setSendWebSocketMessage(() => sendFunction);
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

  const handleGetLibraryFiles = () => {
    if (sendWebSocketMessage) {
      const success = sendWebSocketMessage('get_library_files');
      if (success) {
        console.log('Requested library files from server');
      }
    }
  };

  const handleSave = (data: typeof exampleData) => {
    if (sendWebSocketMessage) {
      const message = JSON.stringify({ event: 'settings_update', data });
      const success = sendWebSocketMessage(message);
      if (!success) {
        console.error('Failed to send settings update');
      } else {
        console.log('Sent settings update');
      }
    } else {
      console.warn('WebSocket not ready to send settings update');
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
          <button onClick={handleGetLibraryFiles} style={dangerButtonStyle}>
          📋 Get Library Files
          </button>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <FileSelector 
              onFileSelect={handleFileSelect} 
              selectedFile={selectedFile}
            />
            {selectedFile ? (
              <div>
                <p><strong>Selected File:</strong> {selectedFile}</p>
                <p><strong>Type:</strong> {selectedFile.endsWith('.yaml') ? 'YAML' : 'CSV'}</p>
                <p><strong>Path:</strong> {selectedFile}</p>
              </div>
            ) : (
              <p>No file selected</p>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h3>File Details</h3>
            <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
              <JsonEditor 
              data={configData} 
              onChange={(newData) => setConfigData(prev => ({
                ...prev,
                ...newData as typeof exampleData
              }))}
              onSave={(newData) => handleSave(newData as typeof exampleData)} 
            />
            </div>
          </div>
        </div>
      </div>
    </div>
  </>)
}
