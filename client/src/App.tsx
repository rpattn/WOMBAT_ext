import { useRef, useState } from 'react';
import './App.css';
import JsonEditor, { type JsonObject } from './components/JsonEditor';
import WebSocketClient from './components/WebSocketClient';
import FileSelector from './components/FileSelector';


export const example_library_structure = {
  "yaml_files": [
    "project\\config\\base.yaml",
    "project\\port\\base_port.yaml",
  ],
  "csv_files": [
    "project\\plant\\layout.csv",
  ],
  "total_files": 2
} as const;

export default function App() {
  const [configData, setConfigData] = useState<JsonObject>({});
  const [sendWebSocketMessage, setSendWebSocketMessage] = useState<((message: string) => boolean) | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [libraryFiles, setLibraryFiles] = useState<{ yaml_files: string[]; csv_files: string[]; total_files?: number } | null>(null);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const pendingDownloadRef = useRef<string | null>(null);

  const handleFileSelect = (filePath: string) => {
    console.log('Selected file:', filePath);
    setSelectedFile(filePath);
    // Reset preview/editor content before loading new file
    setCsvPreview(null);
    setConfigData({});

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

  const handleDownloadFile = (filePath: string) => {
    if (!sendWebSocketMessage) {
      console.warn('WebSocket not ready to request download');
      return;
    }
    pendingDownloadRef.current = filePath;
    const message = JSON.stringify({ event: 'file_select', data: filePath, raw: true });
    const ok = sendWebSocketMessage(message);
    if (!ok) {
      console.error('Failed to request file for download');
      pendingDownloadRef.current = null;
    }
  };

  const handleReplaceFile = (filePath: string) => {
    // Create a hidden file input to pick replacement
    const input = document.createElement('input');
    input.type = 'file';
    const accept = filePath.toLowerCase().endsWith('.csv') ? '.csv' : '.yaml,.yml';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const text = await file.text();
      if (!sendWebSocketMessage) {
        console.warn('WebSocket not ready to send replace_file');
        return;
      }
      const message = JSON.stringify({ event: 'replace_file', data: { file_path: filePath, content: text } });
      const ok = sendWebSocketMessage(message);
      if (!ok) {
        console.error('Failed to send replace_file message');
        return;
      }
      console.log('Sent replace_file for', filePath, 'with local file', file.name);
      // Optionally re-select to fetch updated content
      const selectMsg = JSON.stringify({ event: 'file_select', data: filePath });
      sendWebSocketMessage(selectMsg);
    };
    input.click();
  };

  const handleDeleteFile = (filePath: string) => {
    if (!sendWebSocketMessage) {
      console.warn('WebSocket not ready to send delete_file');
      return;
    }
    const message = JSON.stringify({ event: 'delete_file', data: { file_path: filePath } });
    const ok = sendWebSocketMessage(message);
    if (!ok) {
      console.error('Failed to send delete_file message');
      return;
    }
    console.log('Sent delete_file for', filePath);
    if (selectedFile === filePath) {
      setSelectedFile('');
      setCsvPreview(null);
      setConfigData({});
    }
  };

  const handleAddFile = (filePath: string, content: any) => {
    if (!sendWebSocketMessage) {
      console.warn('WebSocket not ready to send add_file');
      return;
    }
    const message = JSON.stringify({ event: 'add_file', data: { file_path: filePath, content } });
    const ok = sendWebSocketMessage(message);
    if (!ok) {
      console.error('Failed to send add_file message');
      return;
    }
    console.log('Sent add_file for', filePath);
    // Optionally pre-select the file immediately; content will arrive after server stores it
    setSelectedFile(filePath);
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
        // If a download is pending, trigger download and skip UI updates
        if (pendingDownloadRef.current) {
          const filePath = pendingDownloadRef.current;
          try {
            const isCsv = filePath.toLowerCase().endsWith('.csv');
            const isYaml = filePath.toLowerCase().endsWith('.yaml') || filePath.toLowerCase().endsWith('.yml');
            const fileName = filePath.split('\\').pop() || 'download';

            let text: string;
            let mime: string;
            if (typeof parsedData.data === 'string') {
              text = parsedData.data;
              if (isCsv) {
                mime = 'text/csv;charset=utf-8';
              } else if (isYaml) {
                mime = 'application/x-yaml;charset=utf-8';
              } else {
                mime = 'text/plain;charset=utf-8';
              }
            } else {
              // Received structured data (e.g., YAML parsed as object) -> provide JSON download
              text = JSON.stringify(parsedData.data, null, 2);
              mime = 'application/json;charset=utf-8';
            }

            const blob = new Blob([text], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } finally {
            pendingDownloadRef.current = null;
          }
          return;
        }

        // Normal UI update path
        if (typeof parsedData.data === 'string') {
          setCsvPreview(parsedData.data.slice(0, 800));
        } else {
          setConfigData(parsedData.data);
        }
      }
      if (parsedData && typeof parsedData === 'object' &&
        'event' in parsedData && parsedData.event === 'library_files') {
        console.log('Received library files from WebSocket:', parsedData.files);
        setLibraryFiles(parsedData.files);
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

  const handleSave = (data: JsonObject) => {
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

  // styles moved to App.css

  return (<>
    <WebSocketClient onMessage={handleWebSocketMessage} onSendReady={handleSendReady} />
    <div className="app-container">
      <div className="section">
        <h3 className="section-title">Simulation Controls</h3>
        <div className="controls">
          <button onClick={handleRunSimulation} className="btn-app btn-primary">
            🚀 Run Simulation
          </button>
          <button onClick={handleGetConfig} className="btn-app btn-secondary">
            📋 Get Config
          </button>
          <button onClick={handleClearTemp} className="btn-app btn-danger">
            🗑️ Clear Temp
          </button>
          <button onClick={handleGetLibraryFiles} className="btn-app btn-danger">
            📋 Get Library Files
          </button>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <div className="col">
            <FileSelector
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              libraryFiles={libraryFiles ?? undefined}
              onAddFile={handleAddFile}
              onDeleteFile={handleDeleteFile}
              onReplaceFile={handleReplaceFile}
              onDownloadFile={handleDownloadFile}
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
          <div className="col">
            <div className="editor-wrap">
              <JsonEditor
                data={configData}
                onChange={(newData) => setConfigData(prev => ({
                  ...prev,
                  ...newData as JsonObject
                }))}
                onSave={(newData) => handleSave(newData as JsonObject)}
              />
            </div>
          </div>
        </div>
      </div>
      {csvPreview !== null && selectedFile.endsWith('.csv') ? (
        <div>
          <h3 className="csv-preview-title">CSV Preview (first 800 chars)</h3>
          <div className="csv-preview" aria-label="CSV preview">
            {csvPreview}
            {csvPreview.length >= 100 && '…'}
          </div>
          <p className="csv-note">Full CSV editing is not supported yet.</p>
        </div>
      ) : <></>}
    </div>
  </>)
}
