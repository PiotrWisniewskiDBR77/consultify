/**
 * useLocalStorage Hook Tests
 * Tests for the useLocalStorage React hook
 *
 * @module tests/hooks/useLocalStorage.test.tsx
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock localStorage
const mockStorage = new Map<string, string>();

global.localStorage = {
  getItem: vi.fn((key: string) => mockStorage.get(key) || null),
  setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
  removeItem: vi.fn((key: string) => mockStorage.delete(key)),
  clear: vi.fn(() => mockStorage.clear()),
  length: 0,
  key: vi.fn(() => null),
};

// Mock useLocalStorage hook
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  const removeValue = () => {
    localStorage.removeItem(key);
    setStoredValue(initialValue);
  };

  return [storedValue, setValue, removeValue] as const;
}

// Need to import React for the hook
import React from 'react';

describe('useLocalStorage Hook Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Initialization', () => {
    it('should return initial value when storage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test', 'initial'));

      expect(result.current[0]).toBe('initial');
    });

    it('should return stored value when exists', () => {
      mockStorage.set('test', JSON.stringify('stored'));

      const { result } = renderHook(() => useLocalStorage('test', 'initial'));

      expect(result.current[0]).toBe('stored');
    });

    it('should handle object initial values', () => {
      const initial = { name: 'Test', count: 0 };
      const { result } = renderHook(() => useLocalStorage('obj', initial));

      expect(result.current[0]).toEqual(initial);
    });

    it('should handle array initial values', () => {
      const initial = [1, 2, 3];
      const { result } = renderHook(() => useLocalStorage('arr', initial));

      expect(result.current[0]).toEqual(initial);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SET VALUE
  // ═══════════════════════════════════════════════════════════════════

  describe('Set Value', () => {
    it('should update state and storage', () => {
      const { result } = renderHook(() => useLocalStorage('test', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(localStorage.setItem).toHaveBeenCalledWith('test', '"updated"');
    });

    it('should handle functional updates', () => {
      const { result } = renderHook(() => useLocalStorage('count', 0));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);
    });

    it('should update object values', () => {
      const { result } = renderHook(() => useLocalStorage('user', { name: 'John' }));

      act(() => {
        result.current[1]({ name: 'Jane' });
      });

      expect(result.current[0]).toEqual({ name: 'Jane' });
    });

    it('should update array values', () => {
      const { result } = renderHook(() => useLocalStorage<number[]>('items', []));

      act(() => {
        result.current[1]((prev) => [...prev, 1]);
      });

      expect(result.current[0]).toEqual([1]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REMOVE VALUE
  // ═══════════════════════════════════════════════════════════════════

  describe('Remove Value', () => {
    it('should remove from storage and reset to initial', () => {
      mockStorage.set('test', JSON.stringify('stored'));

      const { result } = renderHook(() => useLocalStorage('test', 'initial'));

      expect(result.current[0]).toBe('stored');

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('initial');
      expect(localStorage.removeItem).toHaveBeenCalledWith('test');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should return initial value on invalid JSON', () => {
      mockStorage.set('invalid', 'not{json');

      const { result } = renderHook(() => useLocalStorage('invalid', 'default'));

      expect(result.current[0]).toBe('default');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TYPE SAFETY
  // ═══════════════════════════════════════════════════════════════════

  describe('Type Safety', () => {
    it('should maintain type through updates', () => {
      const { result } = renderHook(() =>
        useLocalStorage<{ count: number }>('typed', { count: 0 })
      );

      act(() => {
        result.current[1]({ count: 5 });
      });

      expect(result.current[0].count).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════

  describe('Persistence', () => {
    it('should persist across hook re-renders', () => {
      const { result, rerender } = renderHook(() => useLocalStorage('persist', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      rerender();

      expect(result.current[0]).toBe('updated');
    });
  });
});
