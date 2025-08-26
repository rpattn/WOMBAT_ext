import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiProvider } from '../context/ApiContext';
import SimulationManager from '../pages/SimulationManager';
import { useApiContext } from '../context/ApiContext';

// Mock the API context
vi.mock('../context/ApiContext', async () => {
  const actual = await vi.importActual('../context/ApiContext');
  return {
    ...actual,
    useApiContext: vi.fn()
  };
});

describe('SimulationManager Interactions', () => {
  const mockSetSelectedFile = vi.fn();
  const mockSetConfigData = vi.fn();
  const mockSetCsvPreview = vi.fn();
  const mockReadFile = vi.fn();
  const mockAddOrReplaceFile = vi.fn();
  const mockDeleteFile = vi.fn();
  const mockDeleteSaved = vi.fn();
  const mockSetSelectedSavedLibrary = vi.fn();

  const defaultContext = {
    libraryFiles: {
      'project/config/base.yaml': { size: 1024, mtime: '2023-01-01T00:00:00Z' },
      'project/turbines/turbine1.yaml': { size: 512, mtime: '2023-01-01T00:00:00Z' },
    },
    savedLibraries: ['project1', 'project2'],
    selectedFile: '',
    setSelectedFile: mockSetSelectedFile,
    configData: {},
    setConfigData: mockSetConfigData,
    csvPreview: null,
    setCsvPreview: mockSetCsvPreview,
    selectedSavedLibrary: '',
    setSelectedSavedLibrary: mockSetSelectedSavedLibrary,
    readFile: mockReadFile,
    addOrReplaceFile: mockAddOrReplaceFile,
    deleteFile: mockDeleteFile,
    deleteSaved: mockDeleteSaved,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useApiContext as jest.Mock).mockReturnValue(defaultContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ApiProvider>
          <SimulationManager />
        </ApiProvider>
      </MemoryRouter>
    );
  };

  it('should render with default state', () => {
    renderComponent();
    expect(screen.getByText('Simulation Manager')).toBeInTheDocument();
    expect(screen.getByText('project/config/base.yaml')).toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    renderComponent();
    
    const fileItem = screen.getByText('project/config/base.yaml');
    fireEvent.click(fileItem);
    
    expect(mockSetSelectedFile).toHaveBeenCalledWith('project/config/base.yaml');
  });

  it('should handle saved library selection', async () => {
    renderComponent();
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'project1' } });
    
    expect(mockSetSelectedSavedLibrary).toHaveBeenCalledWith('project1');
  });

  it('should handle file deletion', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    renderComponent();
    
    const fileItem = screen.getByText('project/config/base.yaml');
    const deleteButton = fileItem.nextElementSibling?.querySelector('button');
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(mockDeleteFile).toHaveBeenCalledWith('project/config/base.yaml');
      });
    } else {
      throw new Error('Delete button not found');
    }
  });

  it('should handle saved library deletion', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    (useApiContext as jest.Mock).mockReturnValue({
      ...defaultContext,
      selectedSavedLibrary: 'project1'
    });
    
    renderComponent();
    
    const deleteButton = screen.getByTitle('Delete selected saved library');
    fireEvent.click(deleteButton);
    
    await waitFor(() => {
      expect(mockDeleteSaved).toHaveBeenCalledWith('project1');
    });
  });

  it('should handle file upload', async () => {
    const file = new File(['test content'], 'test.yaml', { type: 'application/yaml' });
    renderComponent();
    
    const fileInput = screen.getByLabelText('Upload Files');
    
    await act(async () => {
      fireEvent.change(fileInput, {
        target: { files: [file] }
      });
    });
    
    expect(mockAddOrReplaceFile).toHaveBeenCalledWith('project/config/test.yaml', file);
  });
});

// Helper to handle async act warnings
const act = async (callback: () => Promise<void> | void) => {
  const { act: actFn } = await import('@testing-library/react');
  return actFn(callback);
};
