import { useEffect, lazy, Suspense } from 'react';
import '../App.css';
import { type JsonObject } from '../components/JsonEditor';
import CsvPreview from '../components/CsvPreview';
import { useApiContext } from '../context/ApiContext';
import LibraryPanel from '../components/LibraryPanel';
import { useToasts } from '../hooks/useToasts';
import PageWithLibrary from '../components/PageWithLibrary';
import ResizeWrapper from '../components/ResizeWrapper';

const EditorPanel = lazy(() => import('../components/EditorPanel'));

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

export default function SimulationManager() {
  const {
    libraryFiles,
    savedLibraries,
    selectedFile, setSelectedFile,
    configData, setConfigData,
    csvPreview, setCsvPreview,
    pendingDownloadRef,
    selectedSavedLibrary, setSelectedSavedLibrary,
    // REST methods
    readFile,
    addOrReplaceFile,
    deleteFile,
    deleteSaved,
  } = useApiContext();
  const toasts = useToasts();

  // Initialize selected saved library from localStorage on mount
  // and keep it consistent with the list as it arrives/updates.
  const LS_KEY_LAST_SAVED = 'lastSavedLibraryName';


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
    // Fetch via REST
    readFile(filePath, false).catch(err => console.error('readFile error', err));
  };

  const handleDownloadFile = (filePath: string) => {
    pendingDownloadRef.current = filePath;
    readFile(filePath, true).catch(err => {
      console.error('Failed to request file for download', err);
      pendingDownloadRef.current = null;
    });
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
      addOrReplaceFile(filePath, text)
        .then(() => readFile(filePath, false))
        .catch(err => console.error('replace/add file failed', err));
    };
    input.click();
  };

  const handleDeleteFile = (filePath: string) => {
    deleteFile(filePath).catch(err => console.error('delete file failed', err));
    if (selectedFile === filePath) {
      setSelectedFile('');
      setCsvPreview(null);
      setConfigData({});
    }
  };

  const handleAddFile = (filePath: string, content: any) => {
    addOrReplaceFile(filePath, content).catch(err => console.error('add file failed', err));
    // Optionally pre-select the file immediately; content will arrive after server stores it
    setSelectedFile(filePath);
    //toast the user
    toasts.info(`Added file: ${filePath} to working library.`);
  };

  // State is updated centrally in App.tsx; no page-level subscription needed

  const handleSave = (data: JsonObject) => {
    // Persist via REST: use selected YAML file or fallback to base config
    const sel = (selectedFile || '').toLowerCase();
    const isYaml = sel.endsWith('.yaml') || sel.endsWith('.yml');
    const targetPath = isYaml && selectedFile ? selectedFile : 'project\\config\\base.yaml';
    const p = addOrReplaceFile(targetPath, data)
      .then(() => {
        setSelectedFile(targetPath);
        // Refresh editor content from server to reflect canonical YAML dump
        return readFile(targetPath, false).then(() => {
          toasts.success(`Saved ${targetPath}`);
        });
      })
      .catch((err) => {
        console.error('Save failed', err);
        toasts.error('Failed to save configuration');
      });
    // Provide immediate optimistic update as well
    setConfigData(prev => ({ ...prev, ...data }));
    return p;
  };

  return (
    <>
    <PageWithLibrary
      title="Simulation Manager"
      projectPlacement="sidebar"
      projectActions={selectedSavedLibrary ? (
        <div className="panel-body" style={{ paddingTop: 0 }}>
          <button
            className="btn btn-danger"
            style={{ width: '100%', marginBottom: '5px' }}
            onClick={() => {
              const val = selectedSavedLibrary;
              if (!val) return;
              const confirmDel = window.confirm(`Delete saved library: ${val}? This cannot be undone.`);
              if (!confirmDel) return;
              deleteSaved(val).catch(() => {
                toasts.error('Failed to delete saved library');
                return;
              });
              setSelectedSavedLibrary('');
              try { window.localStorage.setItem(LS_KEY_LAST_SAVED, ''); } catch { /* ignore */ }
            }}
            title="Delete selected saved library"
            aria-label="Delete saved library"
          >X</button>
        </div>
      ) : null}
      sidebar={(
        <>
          <LibraryPanel
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            libraryFiles={libraryFiles}
            projectName={selectedSavedLibrary || undefined}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onReplaceFile={handleReplaceFile}
            onDownloadFile={handleDownloadFile}
            defaultExpandFolders={["project/config"]}
          />
        </>
      )}
    >
      <ResizeWrapper minWidth={400} maxWidth={1200} lsKey="simpage.testwidth" defaultWidth={1000} collapsible={true} defaultCollapsed={false}> 
        <div className="row stack-sm">
          {configData && Object.keys(configData || {}).length > 0 && (
            <Suspense fallback={null}>
              <EditorPanel
                data={configData as unknown as JsonObject}
                onChange={(newData) => setConfigData(prev => ({
                  ...prev,
                  ...newData as JsonObject
                }))}
                onSave={(newData) => handleSave(newData as JsonObject)}
              />
            </Suspense>
          )}
        </div>
      </ResizeWrapper>
      <CsvPreview preview={csvPreview} filePath={selectedFile} />
    </PageWithLibrary>
    </>
  );
}
