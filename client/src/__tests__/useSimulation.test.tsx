import { renderHook, act, waitFor } from '@testing-library/react';
import { useSimulation } from '../hooks/useSimulation';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useSimulation', () => {
  const mockSetResults = vi.fn();
  const mockSetLibraryFiles = vi.fn();
  const mockFetchLibraryFiles = vi.fn().mockResolvedValue(undefined);
  const mockRequireSession = vi.fn().mockReturnValue('test-session-id');
  
  const defaultProps = {
    apiBaseUrl: 'http://test-api',
    requireSession: mockRequireSession,
    setResults: mockSetResults,
    setLibraryFiles: mockSetLibraryFiles,
    fetchLibraryFiles: mockFetchLibraryFiles,
  };

  beforeEach(() => {
    global.fetch = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with null progress', () => {
    const { result } = renderHook(() => useSimulation(defaultProps));
    expect(result.current.progress).toBeNull();
  });

  it('should handle successful simulation run with async trigger', async () => {
    const mockTaskId = 'task-123';
    const mockResult = { status: 'success', result: { data: 'test' } };
    
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ task_id: mockTaskId }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          result: mockResult,
          progress: { now: 100, percent: 100, message: 'completed' },
        }),
      });

    const { result } = renderHook(() => useSimulation(defaultProps));
    
    await act(async () => {
      await result.current.runSimulation();
    });

    await waitFor(() => {
      expect(mockRequireSession).toHaveBeenCalled();
      expect(mockSetResults).toHaveBeenCalledWith(mockResult);
      expect(result.current.progress).toEqual({
        now: 100,
        percent: 100,
        message: 'completed',
      });
    });
  });

  it('should handle simulation error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() => useSimulation(defaultProps));
    
    await act(async () => {
      await result.current.runSimulation();
    });

    expect(mockSetResults).not.toHaveBeenCalled();
  });
});
