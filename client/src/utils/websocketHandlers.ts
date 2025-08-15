import type { MutableRefObject } from 'react';
import type { JsonObject } from '../components/JsonEditor';

type LibraryFiles = { yaml_files: string[]; csv_files: string[]; html_files?: string[]; png_files?: string[]; total_files?: number };

export type CreateWebSocketMessageHandlerArgs = {
  setConfigData: (data: any) => void;
  setCsvPreview: (data: string | null) => void;
  setLibraryFiles: (files: LibraryFiles | null) => void;
  setSavedLibraries?: (dirs: string[]) => void;
  pendingDownloadRef: MutableRefObject<string | null>;
  onToast?: (level: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  setResults?: (data: any | null) => void;
  setBinaryPreviewUrl?: (url: string | null) => void;
};

export function createWebSocketMessageHandler({
  setConfigData,
  setCsvPreview,
  setLibraryFiles,
  setSavedLibraries,
  pendingDownloadRef,
  onToast,
  setResults,
  setBinaryPreviewUrl,
}: CreateWebSocketMessageHandlerArgs) {
  return function handleWebSocketMessage(message: string) {
    try {
      const parsedData = JSON.parse(message);

      if (parsedData && typeof parsedData === 'object' && 'name' in parsedData && 'library' in parsedData) {
        // Config payload
        setConfigData(parsedData as JsonObject);
      }

      if (parsedData && typeof parsedData === 'object' && 'event' in parsedData && parsedData.event === 'file_content') {
        // If a download is pending, trigger download and skip UI updates
        if (pendingDownloadRef.current) {
          const filePath = pendingDownloadRef.current;
          try {
            const isCsv = filePath.toLowerCase().endsWith('.csv');
            const isYaml = filePath.toLowerCase().endsWith('.yaml') || filePath.toLowerCase().endsWith('.yml');
            const fileName = filePath.split('\\').pop() || 'download';
            let blob: Blob;
            if (parsedData.data_b64 && parsedData.mime) {
              // Binary download
              const byteChars = atob(parsedData.data_b64 as string);
              const byteNumbers = new Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
              const byteArray = new Uint8Array(byteNumbers);
              blob = new Blob([byteArray], { type: parsedData.mime as string });
            } else {
              // Text or JSON download
              let text: string;
              let mime: string;
              if (typeof parsedData.data === 'string') {
                text = parsedData.data;
                if (isCsv) mime = 'text/csv;charset=utf-8';
                else if (isYaml) mime = 'application/x-yaml;charset=utf-8';
                else mime = (parsedData.mime as string) || 'text/plain;charset=utf-8';
              } else {
                text = JSON.stringify(parsedData.data, null, 2);
                mime = 'application/json;charset=utf-8';
              }
              blob = new Blob([text], { type: mime });
            }
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
        if (parsedData.data_b64 && parsedData.mime && parsedData.mime.startsWith('image/')) {
          // Create blob URL for image preview
          try {
            const byteChars = atob(parsedData.data_b64 as string);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: parsedData.mime as string });
            const url = URL.createObjectURL(blob);
            setCsvPreview(null);
            setBinaryPreviewUrl?.(url);
          } catch {
            setBinaryPreviewUrl?.(null);
          }
        } else if (typeof parsedData.data === 'string') {
          setCsvPreview(parsedData.data);
          setBinaryPreviewUrl?.(null);
        } else {
          setConfigData(parsedData.data);
          setBinaryPreviewUrl?.(null);
        }
      }

      if (parsedData && typeof parsedData === 'object' && 'event' in parsedData && parsedData.event === 'library_files') {
        setLibraryFiles(parsedData.files);
      }

      if (parsedData && typeof parsedData === 'object' && 'event' in parsedData && parsedData.event === 'saved_libraries') {
        if (Array.isArray(parsedData.dirs)) {
          setSavedLibraries?.(parsedData.dirs as string[]);
        }
      }

      // Simulation results payload: { event: 'results', data: {...} }
      if (parsedData && typeof parsedData === 'object' && 'event' in parsedData && parsedData.event === 'results') {
        setResults?.(parsedData.data ?? null);
      }

      // Toast events from server
      if (parsedData && typeof parsedData === 'object' && 'event' in parsedData) {
        // Standard toast envelope: { event: 'toast', level: 'info'|'success'|'warning'|'error', message: string }
        if (parsedData.event === 'toast' && typeof parsedData.message === 'string') {
          const lvl = (parsedData.level ?? 'info') as 'info' | 'success' | 'warning' | 'error';
          onToast?.(lvl, parsedData.message);
        }
        // Common shortcuts: { event: 'error'|'warning'|'info'|'success', message }
        if ((parsedData.event === 'error' || parsedData.event === 'warning' || parsedData.event === 'info' || parsedData.event === 'success') && typeof parsedData.message === 'string') {
          onToast?.(parsedData.event, parsedData.message);
        }
      }
    } catch {
      // Not JSON, ignore
    }
  };
}
