import { useEffect } from 'react';
import FileSelector from '../components/FileSelector';
import SelectedFileInfo from '../components/SelectedFileInfo';
import YamlJsonViewer from '../components/YamlJsonViewer';
import CsvPreview from '../components/CsvPreview';
import ResultsSummary from '../components/ResultsSummary';
import { useApiContext } from '../context/ApiContext';
import PageWithLibrary from '../components/PageWithLibrary';

export default function Results() {
  const {
    libraryFiles,
    selectedFile, setSelectedFile,
    pendingDownloadRef,
    selectedSavedLibrary,
    configData,
    csvPreview,
    binaryPreviewUrl,
    // REST methods
    fetchLibraryFiles,
    readFile,
  } = useApiContext();
  // Shared toasts are handled in App.tsx; this page reads shared state

  // Ensure files are populated when arriving on this page
  useEffect(() => {
    if (!libraryFiles) {
      fetchLibraryFiles().catch(() => {});
    }
  }, [libraryFiles, fetchLibraryFiles]);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    const lf = filePath.toLowerCase();
    const isHtml = lf.endsWith('.html');
    const isPng = lf.endsWith('.png');
    readFile(filePath, isHtml || isPng).catch(() => {});
  };

  const handleDownloadFile = (filePath: string) => {
    pendingDownloadRef.current = filePath;
    readFile(filePath, true).catch(() => { pendingDownloadRef.current = null; });
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
    <PageWithLibrary
      title="Results"
      projectPlacement="sidebar"
      sidebar={(
        <>
          <details open>
            <summary>Files</summary>
            <div className="panel-body">
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
                defaultExpandFolders={['results']}
              />
              <SelectedFileInfo selectedFile={selectedFile} />
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-app btn-secondary"
                  onClick={() => fetchLibraryFiles().catch(() => {})}
                >Refresh Files</button>
              </div>
            </div>
          </details>
        </>
      )}
    >
      <div className="card">
        {(() => {
          const lf = selectedFile?.toLowerCase() || '';
          const isYaml = lf.endsWith('.yaml') || lf.endsWith('.yml');
          const isSummary = lf.includes('summary.yaml');
          const isHtml = lf.endsWith('.html');
          const isCsv = lf.endsWith('.csv');
          const isPng = lf.endsWith('.png');
          if (isSummary) return <ResultsSummary data={configData} />;
          if (isYaml) return <YamlJsonViewer title={selectedFile.split('\\').pop() || 'YAML'} data={configData} />;
          if (isCsv) return <CsvPreview preview={csvPreview} filePath={selectedFile} />;
          if (isHtml) {
            // Render HTML directly in an iframe using the raw content captured by csvPreview
            // Note: server sends raw text when raw: true; websocket handler stores string in csvPreview
            return (
              <div>
                <div style={{ height: '70vh', border: '1px solid #ddd', overflowX: 'auto', overflowY: 'hidden' }}>
                  <iframe
                    title={selectedFile}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    sandbox="allow-scripts allow-same-origin"
                    srcDoc={String(csvPreview || '')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                  <button
                    className="btn-app btn-secondary"
                    title="Open HTML in new tab"
                    aria-label="Open HTML in new tab"
                    onClick={() => {
                      try {
                        const blob = new Blob([String(csvPreview || '')], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } catch {
                        // ignore
                      }
                    }}
                    style={{ padding: '4px 8px' }}
                  >🗗 Open in new tab</button>
                </div>
              </div>
            );
          }
          if (isPng) {
            return (
              <div style={{ height: '85vh', overflowX: 'auto', overflowY: 'auto', border: '1px solid #ddd', padding: 8 }}>
                {binaryPreviewUrl ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img
                    alt={`Image preview: ${selectedFile}`}
                    src={binaryPreviewUrl}
                    style={{ height: 'auto', display: 'block' }}
                  />
                ) : (
                  <div style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>Loading image…</div>
                )}
              </div>
            );
          }
          return <ResultsSummary />;
        })()}
      </div>
    </PageWithLibrary>
  );
}
