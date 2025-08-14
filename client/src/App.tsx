import { useRef, useState, useEffect } from 'react';
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
  type ThemeMode = 'system' | 'light' | 'dark';
  const [theme, setTheme] = useState<ThemeMode>('system');
  const pendingDownloadRef = useRef<string | null>(null);
  const toast = useToast();

  // Initialize selected saved library from localStorage on mount
  // and keep it consistent with the list as it arrives/updates.
  const LS_KEY_LAST_SAVED = 'lastSavedLibraryName';
  const LS_KEY_THEME = 'themePreference';

  // Theme handling
  useEffect(() => {
    // Initialize from localStorage or default to 'system'
    try {
      const stored = (window.localStorage.getItem(LS_KEY_THEME) as ThemeMode | null);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setTheme(stored);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const root = document.documentElement; // <html>
    const mm = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      // clear classes first
      root.classList.remove('dark');
      root.classList.remove('light');
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.add('light');
      } else {
        // system: follow media query (add class to reflect current)
        if (mm.matches) root.classList.add('dark');
        else root.classList.add('light');
      }
    };
    apply();
    const handler = () => { if (theme === 'system') apply(); };
    mm.addEventListener?.('change', handler);
    return () => { mm.removeEventListener?.('change', handler); };
  }, [theme]);

  // Persist theme choice
  useEffect(() => {
    try { window.localStorage.setItem(LS_KEY_THEME, theme); } catch { /* ignore */ }
  }, [theme]);

  // When savedLibraries list updates, ensure the selected value exists.
  useEffect(() => {
    if (selectedSavedLibrary && !savedLibraries.includes(selectedSavedLibrary)) {
      // Previously selected no longer exists; clear it
      setSelectedSavedLibrary('');
    }
  }, [savedLibraries]);

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
    let storedName = '';
    try {
      storedName = window.localStorage.getItem(LS_KEY_LAST_SAVED) || '';
    } catch { /* ignore */ }
    const defaultName = storedName || selectedSavedLibrary || `project-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}`;
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
      try { window.localStorage.setItem(LS_KEY_LAST_SAVED, name); } catch { /* ignore */ }
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
      <div className="row" style={{ marginBottom: '0.75rem', alignItems: 'center' }}>
        <div className="col">
          <SavedLibrariesDropdown
            libraries={savedLibraries}
            value={selectedSavedLibrary}
            onChange={(val: string) => {
              setSelectedSavedLibrary(val);
              try {
                window.localStorage.setItem(LS_KEY_LAST_SAVED, val || '');
              } catch { /* ignore */ }
              if (val) {
                toast.info(`Loading saved library: ${val}`);
                if (sendWebSocketMessage) {
                  const msg = JSON.stringify({ event: 'load_saved_library', data: { name: val } });
                  const ok = sendWebSocketMessage(msg);
                  if (!ok) {
                    toast.error('Failed to request load_saved_library');
                  }
                } else {
                  toast.warning('WebSocket not ready to load saved library');
                }
              }
            }}
          >
            {selectedSavedLibrary && (
              <button
                className="btn btn-outline-danger"
                onClick={() => {
                  if (!selectedSavedLibrary) return;
                  const confirmDel = window.confirm(`Delete saved library: ${selectedSavedLibrary}? This cannot be undone.`);
                  if (!confirmDel) return;
                  if (!sendWebSocketMessage) {
                    toast.warning('WebSocket not ready to delete saved library');
                    return;
                  }
                  const msg = JSON.stringify({ event: 'delete_saved_library', data: { name: selectedSavedLibrary } });
                  const ok = sendWebSocketMessage(msg);
                  if (!ok) {
                    toast.error('Failed to request delete_saved_library');
                    return;
                  }
                  // Optimistically clear selection
                  setSelectedSavedLibrary('');
                  try { window.localStorage.setItem(LS_KEY_LAST_SAVED, ''); } catch { /* ignore */ }
                }}
              >Delete</button>
            )}
          </SavedLibrariesDropdown>
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
              projectName={selectedSavedLibrary || undefined}
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
      <div className="col" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: 12, marginRight: 8 }}>Theme</label>
          <select
            aria-label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeMode)}
            style={{ padding: '6px 8px', borderRadius: 6 }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
    </div>
  </>)
}
