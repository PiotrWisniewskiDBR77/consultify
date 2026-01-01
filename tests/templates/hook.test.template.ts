/**
 * TEMPLATE: React Hook Test
 * 
 * Ten plik służy jako szablon do tworzenia testów hooków React.
 * Skopiuj i dostosuj do konkretnego hooka.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

// Import hook to test
import { useCustomHook, UseCustomHookOptions, UseCustomHookReturn } from '@/hooks/useCustomHook';

// ===== Mocks =====

// Mock API service
vi.mock('@/services/api', () => ({
  apiService: {
    getData: vi.fn(),
    postData: vi.fn(),
    updateData: vi.fn(),
    deleteData: vi.fn(),
  },
}));

// Mock other hooks if needed
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Test User' },
    isAuthenticated: true,
  }),
}));

// Mock toast notifications
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import { apiService } from '@/services/api';

// ===== Test Wrapper =====

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

// Helper to render hook with wrapper
const renderCustomHook = (options?: UseCustomHookOptions) => {
  return renderHook(() => useCustomHook(options), {
    wrapper: TestWrapper,
  });
};

// ===== Tests =====

describe('useCustomHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(apiService.getData).mockResolvedValue([
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== Initial State =====

  describe('initial state', () => {
    it('should return initial loading state', () => {
      const { result } = renderCustomHook();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should accept initial options', () => {
      const { result } = renderCustomHook({ 
        initialData: [{ id: 1, name: 'Initial' }],
        autoFetch: false,
      });

      expect(result.current.data).toEqual([{ id: 1, name: 'Initial' }]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ===== Data Fetching =====

  describe('data fetching', () => {
    it('should fetch data on mount', async () => {
      const { result } = renderCustomHook();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiService.getData).toHaveBeenCalledTimes(1);
      expect(result.current.data).toHaveLength(2);
    });

    it('should not fetch when autoFetch is false', () => {
      renderCustomHook({ autoFetch: false });

      expect(apiService.getData).not.toHaveBeenCalled();
    });

    it('should refetch when dependencies change', async () => {
      const { result, rerender } = renderHook(
        ({ filter }) => useCustomHook({ filter }),
        {
          wrapper: TestWrapper,
          initialProps: { filter: 'active' },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiService.getData).toHaveBeenCalledWith({ filter: 'active' });

      rerender({ filter: 'inactive' });

      await waitFor(() => {
        expect(apiService.getData).toHaveBeenCalledWith({ filter: 'inactive' });
      });

      expect(apiService.getData).toHaveBeenCalledTimes(2);
    });
  });

  // ===== Error Handling =====

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      const testError = new Error('Failed to fetch');
      vi.mocked(apiService.getData).mockRejectedValueOnce(testError);

      const { result } = renderCustomHook();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.data).toEqual([]);
    });

    it('should clear error on successful refetch', async () => {
      vi.mocked(apiService.getData)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce([{ id: 1, name: 'Success' }]);

      const { result } = renderCustomHook();

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toHaveLength(1);
    });
  });

  // ===== Mutations =====

  describe('mutations', () => {
    describe('create', () => {
      it('should create item and update data', async () => {
        const newItem = { id: 3, name: 'New Item' };
        vi.mocked(apiService.postData).mockResolvedValueOnce(newItem);

        const { result } = renderCustomHook();

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          await result.current.create({ name: 'New Item' });
        });

        expect(apiService.postData).toHaveBeenCalledWith({ name: 'New Item' });
        expect(result.current.data).toContainEqual(newItem);
      });

      it('should handle create error', async () => {
        vi.mocked(apiService.postData).mockRejectedValueOnce(new Error('Create failed'));

        const { result } = renderCustomHook();

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await expect(
          act(async () => {
            await result.current.create({ name: 'New Item' });
          })
        ).rejects.toThrow('Create failed');
      });
    });

    describe('update', () => {
      it('should update item in data', async () => {
        const updatedItem = { id: 1, name: 'Updated Name' };
        vi.mocked(apiService.updateData).mockResolvedValueOnce(updatedItem);

        const { result } = renderCustomHook();

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          await result.current.update(1, { name: 'Updated Name' });
        });

        expect(apiService.updateData).toHaveBeenCalledWith(1, { name: 'Updated Name' });
        expect(result.current.data.find((i) => i.id === 1)?.name).toBe('Updated Name');
      });

      it('should rollback on update error', async () => {
        vi.mocked(apiService.updateData).mockRejectedValueOnce(new Error('Update failed'));

        const { result } = renderCustomHook();

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const originalData = [...result.current.data];

        try {
          await act(async () => {
            await result.current.update(1, { name: 'Updated' });
          });
        } catch {
          // Expected error
        }

        expect(result.current.data).toEqual(originalData);
      });
    });

    describe('delete', () => {
      it('should remove item from data', async () => {
        vi.mocked(apiService.deleteData).mockResolvedValueOnce(undefined);

        const { result } = renderCustomHook();

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const initialLength = result.current.data.length;

        await act(async () => {
          await result.current.remove(1);
        });

        expect(result.current.data.length).toBe(initialLength - 1);
        expect(result.current.data.find((i) => i.id === 1)).toBeUndefined();
      });
    });
  });

  // ===== Pagination =====

  describe('pagination', () => {
    beforeEach(() => {
      vi.mocked(apiService.getData).mockResolvedValue({
        items: [{ id: 1 }, { id: 2 }],
        total: 10,
        page: 1,
        pageSize: 2,
      });
    });

    it('should handle pagination state', async () => {
      const { result } = renderCustomHook({ pageSize: 2 });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination).toEqual({
        page: 1,
        pageSize: 2,
        total: 10,
        totalPages: 5,
      });
    });

    it('should fetch next page', async () => {
      const { result } = renderCustomHook({ pageSize: 2 });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.goToPage(2);
      });

      expect(apiService.getData).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  // ===== Optimistic Updates =====

  describe('optimistic updates', () => {
    it('should apply optimistic update immediately', async () => {
      vi.mocked(apiService.updateData).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: 'Server Name' }), 100))
      );

      const { result } = renderCustomHook();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.update(1, { name: 'Optimistic Name' });
      });

      // Should immediately reflect optimistic update
      expect(result.current.data.find((i) => i.id === 1)?.name).toBe('Optimistic Name');

      // Wait for server response
      await waitFor(() => {
        expect(result.current.data.find((i) => i.id === 1)?.name).toBe('Server Name');
      });
    });
  });

  // ===== Debouncing =====

  describe('debouncing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce rapid search changes', async () => {
      const { result } = renderCustomHook({ debounceMs: 300 });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear initial call count
      vi.mocked(apiService.getData).mockClear();

      // Simulate rapid typing
      act(() => {
        result.current.setSearch('a');
        result.current.setSearch('ab');
        result.current.setSearch('abc');
      });

      // Should not call API yet
      expect(apiService.getData).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should call API once with final value
      expect(apiService.getData).toHaveBeenCalledTimes(1);
      expect(apiService.getData).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'abc' })
      );
    });
  });

  // ===== Cleanup =====

  describe('cleanup', () => {
    it('should cancel pending requests on unmount', async () => {
      const abortSpy = vi.fn();
      vi.mocked(apiService.getData).mockImplementation(
        () => new Promise((_, reject) => {
          const controller = new AbortController();
          controller.signal.addEventListener('abort', abortSpy);
          setTimeout(() => reject(new Error('Aborted')), 1000);
        })
      );

      const { unmount } = renderCustomHook();

      unmount();

      // Verify cleanup happened (implementation-specific)
    });

    it('should not update state after unmount', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiService.getData).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ id: 1 }]), 100))
      );

      const { unmount } = renderCustomHook();

      unmount();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not log "Can't perform a React state update on an unmounted component"
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ===== Type Safety =====

  describe('type safety', () => {
    it('should return correctly typed data', async () => {
      interface CustomItem {
        id: number;
        name: string;
        status: 'active' | 'inactive';
      }

      vi.mocked(apiService.getData).mockResolvedValue([
        { id: 1, name: 'Test', status: 'active' },
      ] as CustomItem[]);

      const { result } = renderHook(
        () => useCustomHook<CustomItem>(),
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // TypeScript should enforce correct type access
      const item = result.current.data[0];
      expect(item.status).toBe('active');
    });
  });
});


