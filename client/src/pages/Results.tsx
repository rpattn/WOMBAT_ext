import { useEffect } from 'react';
import FileSelector from '../components/FileSelector';
import SelectedFileInfo from '../components/SelectedFileInfo';
import { useWebSocketContext } from '../context/WebSocketContext';
import SavedLibrariesDropdown from '../components/SavedLibrariesDropdown';
import YamlJsonViewer from '../components/YamlJsonViewer';
import ResultsSummary from '../components/ResultsSummary';

export default function Results() {
  const {
    send: sendWebSocketMessage,
    libraryFiles,
    selectedFile, setSelectedFile,
    pendingDownloadRef,
    savedLibraries,
    selectedSavedLibrary, setSelectedSavedLibrary,
    configData,
  } = useWebSocketContext();
  // Shared toasts are handled in App.tsx; this page reads shared state

  // Ensure files are populated when arriving on this page
  useEffect(() => {
    if (!libraryFiles && sendWebSocketMessage) {
      sendWebSocketMessage('get_library_files');
    }
  }, [libraryFiles, sendWebSocketMessage]);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    if (sendWebSocketMessage) {
      const msg = JSON.stringify({ event: 'file_select', data: filePath });
      sendWebSocketMessage(msg);
    }
  };

  const handleDownloadFile = (filePath: string) => {
    if (!sendWebSocketMessage) return;
    pendingDownloadRef.current = filePath;
    const message = JSON.stringify({ event: 'file_select', data: filePath, raw: true });
    sendWebSocketMessage(message);
  };

  const handleAddFile = (_filePath: string, _content: any) => {
    // Optional: Add support if results needs uploads later.
  };

  const handleDeleteFile = (_filePath: string) => {
    // Optional: Deletion not needed for results viewer.
  };

  const handleReplaceFile = (_filePath: string) => {
    // Optional: Replacement not needed for results viewer.
  };

  return (
    <div className="app-container app-full" style={{ paddingTop: '1rem' }}>
      <div className="card">
        <div className="row stack-sm">
          <div className="col col-1-4">
            <details open>
              <summary style={{textAlign: 'left', padding: '0px 16px'}}>Files</summary>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  {/* Shared Saved Libraries selector */}
                <SavedLibrariesDropdown
                  libraries={savedLibraries}
                  value={selectedSavedLibrary}
                  onChange={(val: string) => {
                    setSelectedSavedLibrary(val);
                    try {
                      window.localStorage.setItem('lastSavedLibraryName', val || '');
                    } catch { /* ignore */ }
                    if (val && sendWebSocketMessage) {
                      const msg = JSON.stringify({ event: 'load_saved_library', data: { name: val } });
                      sendWebSocketMessage(msg);
                    }
                  }}
                >
                </SavedLibrariesDropdown>
              </div>
              <FileSelector
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                libraryFiles={libraryFiles ?? undefined}
                projectName={selectedSavedLibrary || undefined}
                onAddFile={handleAddFile}
                onDeleteFile={handleDeleteFile}
                onReplaceFile={handleReplaceFile}
                onDownloadFile={handleDownloadFile}
                showActions={false}
              />
              <SelectedFileInfo selectedFile={selectedFile} />
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-app btn-secondary"
                  onClick={() => sendWebSocketMessage?.('get_library_files')}
                >Refresh Files</button>
              </div>
            </div>
            </details>
          </div>
          <div className="col col-3-4">
            <div className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0 }}>Results</h2>
              {(() => {
                const lf = selectedFile?.toLowerCase() || '';
                const isYaml = lf.endsWith('.yaml') || lf.endsWith('.yml');
                const isSummary = lf.includes('summary.yaml');
                if (isSummary) {
                  return <ResultsSummary />;
                }
                if (isYaml) {
                  return <YamlJsonViewer title={selectedFile.split('\\').pop() || 'YAML'} data={configData} />;
                }
                return <ResultsSummary />;
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
