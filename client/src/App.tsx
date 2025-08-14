import { useRef, useState } from 'react';
import './App.css';
import JsonEditor, { type JsonObject } from './components/JsonEditor';
import WebSocketClient from './components/WebSocketClient';
import FileSelector from './components/FileSelector';
import SimulationControls from './components/SimulationControls';
import SelectedFileInfo from './components/SelectedFileInfo';
import CsvPreview from './components/CsvPreview';
import SavedLibrariesDropdown from './components/SavedLibrariesDropdown';
import { createWebSocketMessageHandler } from './utils/websocketHandlers';
import { useToast } from './components/ToastManager';


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
  const [savedLibraries, setSavedLibraries] = useState<string[]>([]);
  const [selectedSavedLibrary, setSelectedSavedLibrary] = useState<string | ''>('');
  const pendingDownloadRef = useRef<string | null>(null);
  const toast = useToast();

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

  const handleWebSocketMessage = createWebSocketMessageHandler({
    setConfigData,
    setCsvPreview,
    setLibraryFiles,
    setSavedLibraries,
    pendingDownloadRef,
    onToast: (level, message) => {
      switch (level) {
        case 'success':
          toast.success(message);
          break;
        case 'warning':
          toast.warning(message);
          break;
        case 'error':
          toast.error(message);
          break;
        default:
          toast.info(message);
      }
    },
  });

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

  const handleSaveLibrary = () => {
    // Ask user for a project name
    const defaultName = `project-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}`;
    const name = window.prompt('Enter a project name to save the current library:', defaultName)?.trim();
    if (!name) {
      console.log('Save library cancelled or empty name');
      return;
    }
    if (!sendWebSocketMessage) {
      console.warn('WebSocket not ready to send save_library');
      return;
    }
    const payload = JSON.stringify({ event: 'save_library', data: { project_name: name } });
    const ok = sendWebSocketMessage(payload);
    if (ok) {
      console.log('Requested save_library for', name);
    } else {
      console.error('Failed to send save_library');
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
      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <div className="col">
          <SavedLibrariesDropdown
            libraries={savedLibraries}
            value={selectedSavedLibrary}
            onChange={(val: string) => {
              setSelectedSavedLibrary(val);
              if (val) {
                toast.info(`Selected saved library: ${val}`);
              }
            }}
          />
        </div>
      </div>
      <SimulationControls
        onRun={handleRunSimulation}
        onGetConfig={handleGetConfig}
        onClearTemp={handleClearTemp}
        onGetLibraryFiles={handleGetLibraryFiles}
        onSaveLibrary={handleSaveLibrary}
      />
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
            <SelectedFileInfo selectedFile={selectedFile} />
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
      <CsvPreview preview={csvPreview} filePath={selectedFile} />
    </div>
  </>)
}
