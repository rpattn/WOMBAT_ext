import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { JsonObject } from '../components/JsonEditor';

export type WsMessageHandler = (message: string) => void;

export type WebSocketContextType = {
  send: ((message: string) => boolean) | null;
  setSend: (fn: ((message: string) => boolean) | null) => void;
  addListener: (handler: WsMessageHandler) => () => void; // returns unsubscribe
  notify: (message: string) => void;

  // Shared data
  libraryFiles: { yaml_files: string[]; csv_files: string[]; total_files?: number } | null;
  setLibraryFiles: React.Dispatch<React.SetStateAction<{ yaml_files: string[]; csv_files: string[]; total_files?: number } | null>>;
  savedLibraries: string[];
  setSavedLibraries: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSavedLibrary: string;
  setSelectedSavedLibrary: React.Dispatch<React.SetStateAction<string>>;
  selectedFile: string;
  setSelectedFile: React.Dispatch<React.SetStateAction<string>>;
  configData: JsonObject;
  setConfigData: React.Dispatch<React.SetStateAction<JsonObject>>;
  csvPreview: string | null;
  setCsvPreview: React.Dispatch<React.SetStateAction<string | null>>;
  pendingDownloadRef: React.MutableRefObject<string | null>;

  // Simulation results
  results: any | null;
  setResults: React.Dispatch<React.SetStateAction<any | null>>;
};

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: PropsWithChildren) {
  const [sendFn, setSendFn] = useState<((message: string) => boolean) | null>(null);
  const listenersRef = useRef(new Set<WsMessageHandler>());

  // Shared data state
  const [libraryFiles, setLibraryFiles] = useState<{ yaml_files: string[]; csv_files: string[]; total_files?: number } | null>(null);
  const [savedLibraries, setSavedLibraries] = useState<string[]>([]);
  const [selectedSavedLibrary, setSelectedSavedLibrary] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [configData, setConfigData] = useState<JsonObject>({});
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const pendingDownloadRef = useRef<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  // Initialize from localStorage (persist selection across pages/reloads)
  /*
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('lastSavedLibraryName') || '';
      if (stored) setSelectedSavedLibrary(stored);
    } catch { }
  }, []);
  */

  const setSend = useCallback((fn: ((message: string) => boolean) | null) => {
    setSendFn(() => fn);
  }, []);

  const addListener = useCallback((handler: WsMessageHandler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  const notify = useCallback((message: string) => {
    // Spread to array to avoid mutation during iteration issues
    const handlers = Array.from(listenersRef.current);
    for (const h of handlers) {
      try { h(message); } catch { /* ignore listener errors */ }
    }
  }, []);

  const value = useMemo<WebSocketContextType>(() => ({
    send: sendFn,
    setSend,
    addListener,
    notify,

    libraryFiles,
    setLibraryFiles,
    savedLibraries,
    setSavedLibraries,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    selectedFile,
    setSelectedFile,
    configData,
    setConfigData,
    csvPreview,
    setCsvPreview,
    pendingDownloadRef,

    results,
    setResults,
  }), [sendFn, setSend, addListener, notify, libraryFiles, savedLibraries, selectedSavedLibrary, selectedFile, configData, csvPreview, results]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextType {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  return ctx;
}
