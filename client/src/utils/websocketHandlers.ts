import type { MutableRefObject } from 'react';
import type { JsonObject } from '../components/JsonEditor';

export type CreateWebSocketMessageHandlerArgs = {
  setConfigData: (data: any) => void;
  setCsvPreview: (data: string | null) => void;
  setLibraryFiles: (files: { yaml_files: string[]; csv_files: string[]; total_files?: number } | null) => void;
  pendingDownloadRef: MutableRefObject<string | null>;
  onToast?: (level: 'info' | 'success' | 'warning' | 'error', message: string) => void;
};

export function createWebSocketMessageHandler({
  setConfigData,
  setCsvPreview,
  setLibraryFiles,
  pendingDownloadRef,
  onToast,
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

      if (parsedData && typeof parsedData === 'object' && 'event' in parsedData && parsedData.event === 'library_files') {
        setLibraryFiles(parsedData.files);
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
