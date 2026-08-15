/**
 * @vitest-environment jsdom
 *
 * useKeyboardShortcuts Hook Tests
 * Tests for keyboard shortcuts management hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Mock Api service
vi.mock('@/services/api', () => ({
  Api: {
    getShortcuts: vi.fn().mockResolvedValue({
      preferences: {
        enabled: true,
        preset: 'default',
        customShortcuts: {},
        disabledShortcuts: [],
      },
    }),
  },
}));

describe('useKeyboardShortcuts Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('returns activeShortcuts array', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(Array.isArray(result.current.activeShortcuts)).toBe(true);
      expect(result.current.activeShortcuts.length).toBeGreaterThan(0);
    });

    it('returns loading state', () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      // Initially should be loading or already loaded
      expect(typeof result.current.loading).toBe('boolean');
    });

    it('returns shortcuts configuration', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.shortcuts).toBeDefined();
      });
    });
  });

  describe('Default Shortcuts', () => {
    it('includes navigation shortcuts', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const navShortcuts = result.current.activeShortcuts.filter(
        (s) => s.category === 'navigation'
      );

      expect(navShortcuts.length).toBeGreaterThan(0);
    });

    it('includes task management shortcuts', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const taskShortcuts = result.current.activeShortcuts.filter(
        (s) => s.category === 'task_management'
      );

      expect(taskShortcuts.length).toBeGreaterThan(0);
    });

    it('includes help shortcut', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const helpShortcut = result.current.activeShortcuts.find((s) => s.id === 'help');
      expect(helpShortcut).toBeDefined();
    });
  });

  describe('Shortcut Information', () => {
    it('provides name for each shortcut', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.activeShortcuts.forEach((shortcut) => {
        expect(shortcut.name).toBeDefined();
        expect(shortcut.name.length).toBeGreaterThan(0);
      });
    });

    it('provides description for each shortcut', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.activeShortcuts.forEach((shortcut) => {
        expect(shortcut.description).toBeDefined();
      });
    });

    it('provides category for each shortcut', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.activeShortcuts.forEach((shortcut) => {
        expect(shortcut.category).toBeDefined();
      });
    });

    it('provides defaultKey for each shortcut', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.activeShortcuts.forEach((shortcut) => {
        expect(shortcut.defaultKey).toBeDefined();
      });
    });
  });

  describe('API Methods', () => {
    it('exposes reload method', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      expect(typeof result.current.reload).toBe('function');
    });

    it('exposes the persisted enabled state', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(true);
    });

    it('exposes active bindings with currentKey', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(
        result.current.activeShortcuts.every((shortcut) => shortcut.currentKey.length > 0)
      ).toBe(true);
    });

    it('exposes the canonical shortcut preferences', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.shortcuts.preset).toBe('default');
    });

    it('exposes getShortcutKey method', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      expect(typeof result.current.getShortcutKey).toBe('function');
    });

    it('exposes isShortcutEnabled method', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      expect(typeof result.current.isShortcutEnabled).toBe('function');
    });
  });

  describe('Callback Support', () => {
    it('accepts onShortcutTriggered callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          onShortcutTriggered: callback,
        })
      );

      expect(result.current).toBeDefined();
    });
  });
});
