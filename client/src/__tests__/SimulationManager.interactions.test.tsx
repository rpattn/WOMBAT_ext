import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../components/ToastManager'
import SimulationManager from '../pages/SimulationManager'

// Mock useToasts to observe calls
vi.mock('../hooks/useToasts', () => {
  return {
    useToasts: () => ({
      info: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      simulation: vi.fn(),
      tempSweep: vi.fn(),
    }),
  }
})

// Mock child components to simple test doubles for targeted interactions
vi.mock('../components/SimulationControls', () => {
  return {
    default: ({ onRun, onGetConfig, onClearTemp, onGetLibraryFiles, onSaveLibrary }: any) => (
      <div>
        <button data-testid="btn-run" onClick={onRun}>run</button>
        <button data-testid="btn-get-config" onClick={onGetConfig}>get-config</button>
        <button data-testid="btn-clear-temp" onClick={onClearTemp}>clear-temp</button>
        <button data-testid="btn-get-lib" onClick={onGetLibraryFiles}>get-lib</button>
        <button data-testid="btn-save-lib" onClick={onSaveLibrary}>save-lib</button>
      </div>
    )
  }
})

vi.mock('../components/LibraryPanel', () => {
  return {
    default: ({ onFileSelect, onAddFile, onDeleteFile, onReplaceFile, onDownloadFile }: any) => (
      <div>
        <button data-testid="select-file" onClick={() => onFileSelect('project\\config\\base.yaml')}>select-file</button>
        <button data-testid="add-file" onClick={() => onAddFile('new.yaml', { a: 1 })}>add-file</button>
        <button data-testid="delete-file" onClick={() => onDeleteFile('project\\config\\base.yaml')}>delete-file</button>
        <button data-testid="replace-file" onClick={() => onReplaceFile('project\\config\\base.yaml')}>replace-file</button>
        <button data-testid="download-file" onClick={() => onDownloadFile('project\\config\\base.yaml')}>download-file</button>
      </div>
    )
  }
})

vi.mock('../components/CsvPreview', () => ({
  default: () => <div data-testid="csv-preview" />
}))

// Mock ApiContext to control state and observe calls
const spies = {
  setSelectedSavedLibrary: vi.fn(),
  setSelectedFile: vi.fn(),
  setConfigData: vi.fn(),
  setCsvPreview: vi.fn(),
  readFile: vi.fn(async () => {}),
  addOrReplaceFile: vi.fn(async () => {}),
  deleteFile: vi.fn(async () => {}),
  getConfig: vi.fn(async () => {}),
  runSimulation: vi.fn(async () => {}),
  fetchLibraryFiles: vi.fn(async () => {}),
  saveLibrary: vi.fn(async () => {}),
  loadSaved: vi.fn(async () => {}),
  deleteSaved: vi.fn(async () => {}),
  sweepTemp: vi.fn(async () => 1),
}

vi.mock('../context/ApiContext', async (importOriginal) => {
  const mod = await importOriginal<any>()
  return {
    ...mod,
    useApiContext: () => ({
      apiBaseUrl: 'http://x', setApiBaseUrl: vi.fn(),
      sessionId: 'mock-123', initSession: vi.fn(), endSession: vi.fn(),

      libraryFiles: { yaml_files: ['project\\config\\base.yaml'], csv_files: [], total_files: 1 },
      setLibraryFiles: vi.fn(),
      savedLibraries: ['lib1', 'lib2'],
      setSavedLibraries: vi.fn(),
      selectedSavedLibrary: 'lib1',
      setSelectedSavedLibrary: spies.setSelectedSavedLibrary,
      selectedFile: 'project\\config\\base.yaml',
      setSelectedFile: spies.setSelectedFile,
      configData: {},
      setConfigData: spies.setConfigData,
      csvPreview: null,
      setCsvPreview: spies.setCsvPreview,
      binaryPreviewUrl: null,
      setBinaryPreviewUrl: vi.fn(),
      pendingDownloadRef: { current: null },

      results: null, setResults: vi.fn(),

      refreshAll: vi.fn(async () => {}),
      getConfig: spies.getConfig,
      fetchLibraryFiles: spies.fetchLibraryFiles,
      fetchSavedLibraries: vi.fn(async () => {}),
      readFile: spies.readFile,
      addOrReplaceFile: spies.addOrReplaceFile,
      deleteFile: spies.deleteFile,
      saveLibrary: spies.saveLibrary,
      loadSaved: spies.loadSaved,
      deleteSaved: spies.deleteSaved,
      runSimulation: spies.runSimulation,
      clearClientTemp: vi.fn(async () => true),
      sweepTemp: spies.sweepTemp,
      sweepTempAll: vi.fn(async () => 0),
    })
  }
})

beforeEach(() => {
  Object.values(spies).forEach((fn) => (fn as any).mockClear?.())
})

function renderPage() {
  return render(
    <ToastProvider>
      <SimulationManager />
    </ToastProvider>
  )
}

describe('SimulationManager interactions', () => {
  it('triggers simulation controls actions', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('btn-run'))
    fireEvent.click(screen.getByTestId('btn-get-config'))
    fireEvent.click(screen.getByTestId('btn-clear-temp'))
    fireEvent.click(screen.getByTestId('btn-get-lib'))

    await waitFor(() => {
      expect(spies.runSimulation).toHaveBeenCalled()
      expect(spies.getConfig).toHaveBeenCalled()
      expect(spies.sweepTemp).toHaveBeenCalled()
      expect(spies.fetchLibraryFiles).toHaveBeenCalled()
    })
  })

  it('handles save library prompt cancel and success paths', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')

    // Cancel path
    promptSpy.mockReturnValueOnce(null as any)
    renderPage()
    fireEvent.click(screen.getByTestId('btn-save-lib'))
    await waitFor(() => {
      expect(spies.saveLibrary).not.toHaveBeenCalled()
    })

    // Success path
    promptSpy.mockReturnValueOnce('myproj')
    fireEvent.click(screen.getByTestId('btn-save-lib'))
    await waitFor(() => {
      expect(spies.saveLibrary).toHaveBeenCalledWith('myproj')
    })

    promptSpy.mockRestore()
  })

  it('handles library panel actions and updates state', async () => {
    renderPage()
    // select file -> clears previews, sets selection and reads
    fireEvent.click(screen.getByTestId('select-file'))
    await waitFor(() => {
      expect(spies.setSelectedFile).toHaveBeenCalled()
      expect(spies.setCsvPreview).toHaveBeenCalledWith(null)
      expect(spies.setConfigData).toHaveBeenCalled()
      expect(spies.readFile).toHaveBeenCalled()
    })

    // download triggers raw read and sets pending
    fireEvent.click(screen.getByTestId('download-file'))
    await waitFor(() => {
      expect(spies.readFile).toHaveBeenCalled()
    })

    // replace uses input + click; we cannot simulate File API here, but handler is invoked
    fireEvent.click(screen.getByTestId('replace-file'))
    // delete file path
    fireEvent.click(screen.getByTestId('delete-file'))
    await waitFor(() => {
      expect(spies.deleteFile).toHaveBeenCalled()
    })
  })

  it('handles saved libraries change and delete branches', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')

    renderPage()

    // Change selection to lib2 -> triggers loadSaved through SavedLibrariesBar onChange
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'lib2' } })
    await waitFor(() => {
      expect(spies.setSelectedSavedLibrary).toHaveBeenCalledWith('lib2')
      expect(spies.loadSaved).toHaveBeenCalledWith('lib2')
    })

    // Delete cancel path
    confirmSpy.mockReturnValueOnce(false)
    const deleteBtn = screen.getByRole('button', { name: /Delete saved library/i })
    fireEvent.click(deleteBtn)
    await waitFor(() => {
      expect(spies.deleteSaved).not.toHaveBeenCalled()
    })

    // Delete confirm path
    confirmSpy.mockReturnValueOnce(true)
    fireEvent.click(deleteBtn)
    await waitFor(() => {
      expect(spies.deleteSaved).toHaveBeenCalled()
      expect(spies.setSelectedSavedLibrary).toHaveBeenCalledWith('')
    })

    confirmSpy.mockRestore()
  })
})
