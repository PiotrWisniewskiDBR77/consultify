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
        getKeyboardShortcuts: vi.fn().mockResolvedValue({
            enabled: true,
            preset: 'default',
            customMappings: {},
            disabledActions: []
        }),
        updateKeyboardShortcuts: vi.fn().mockResolvedValue({})
    }
}));

describe('useKeyboardShortcuts Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('returns allShortcuts array', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(Array.isArray(result.current.allShortcuts)).toBe(true);
            expect(result.current.allShortcuts.length).toBeGreaterThan(0);
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

            const navShortcuts = result.current.allShortcuts.filter(
                s => s.category === 'navigation'
            );

            expect(navShortcuts.length).toBeGreaterThan(0);
        });

        it('includes task management shortcuts', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const taskShortcuts = result.current.allShortcuts.filter(
                s => s.category === 'task_management'
            );

            expect(taskShortcuts.length).toBeGreaterThan(0);
        });

        it('includes help shortcut', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const helpShortcut = result.current.allShortcuts.find(s => s.id === 'help');
            expect(helpShortcut).toBeDefined();
        });
    });

    describe('Shortcut Information', () => {
        it('provides name for each shortcut', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            result.current.allShortcuts.forEach(shortcut => {
                expect(shortcut.name).toBeDefined();
                expect(shortcut.name.length).toBeGreaterThan(0);
            });
        });

        it('provides description for each shortcut', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            result.current.allShortcuts.forEach(shortcut => {
                expect(shortcut.description).toBeDefined();
            });
        });

        it('provides category for each shortcut', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            result.current.allShortcuts.forEach(shortcut => {
                expect(shortcut.category).toBeDefined();
            });
        });

        it('provides defaultKey for each shortcut', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            result.current.allShortcuts.forEach(shortcut => {
                expect(shortcut.defaultKey).toBeDefined();
            });
        });
    });

    describe('API Methods', () => {
        it('exposes setEnabled method', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(typeof result.current.setEnabled).toBe('function');
        });

        it('exposes setPreset method', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(typeof result.current.setPreset).toBe('function');
        });

        it('exposes setCustomShortcut method', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(typeof result.current.setCustomShortcut).toBe('function');
        });

        it('exposes resetAll method', async () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(typeof result.current.resetAll).toBe('function');
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
            const { result } = renderHook(() => useKeyboardShortcuts({
                onShortcutTriggered: callback
            }));

            expect(result.current).toBeDefined();
        });
    });
});
