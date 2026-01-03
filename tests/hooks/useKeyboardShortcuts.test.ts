/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' })
}));

describe('useKeyboardShortcuts Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('starts enabled by default', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(result.current.isEnabled).toBe(true);
        });

        it('can start disabled', () => {
            const { result } = renderHook(() => useKeyboardShortcuts({ enabled: false }));

            expect(result.current.isEnabled).toBe(false);
        });

        it('showHelp starts as false', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(result.current.showHelp).toBe(false);
        });

        it('returns all shortcuts', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(result.current.allShortcuts.length).toBeGreaterThan(0);
        });
    });

    describe('Default Shortcuts', () => {
        it('includes navigation shortcuts', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            const navShortcuts = result.current.allShortcuts.filter(
                s => s.category === 'Navigation'
            );

            expect(navShortcuts.length).toBeGreaterThan(0);
            expect(navShortcuts.some(s => s.key === 'f')).toBe(true);
            expect(navShortcuts.some(s => s.key === 'i')).toBe(true);
            expect(navShortcuts.some(s => s.key === 't')).toBe(true);
        });

        it('includes action shortcuts', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            const actionShortcuts = result.current.allShortcuts.filter(
                s => s.category === 'Actions'
            );

            expect(actionShortcuts.length).toBeGreaterThan(0);
            expect(actionShortcuts.some(s => s.key === 'c')).toBe(true);
            expect(actionShortcuts.some(s => s.key === '/')).toBe(true);
            expect(actionShortcuts.some(s => s.key === 'Escape')).toBe(true);
        });

        it('includes help shortcut', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            const helpShortcut = result.current.allShortcuts.find(s => s.key === '?');

            expect(helpShortcut).toBeDefined();
            expect(helpShortcut?.modifiers).toContain('shift');
        });
    });

    describe('Custom Shortcuts', () => {
        it('merges custom shortcuts with defaults', () => {
            const customShortcut = {
                key: 'x',
                action: vi.fn(),
                description: 'Custom action',
                category: 'Custom'
            };

            const { result } = renderHook(() => useKeyboardShortcuts({
                shortcuts: [customShortcut]
            }));

            expect(result.current.allShortcuts.some(s => s.key === 'x')).toBe(true);
        });
    });

    describe('Toggle Shortcuts', () => {
        it('toggleShortcuts toggles isEnabled', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(result.current.isEnabled).toBe(true);

            act(() => {
                result.current.toggleShortcuts();
            });

            expect(result.current.isEnabled).toBe(false);

            act(() => {
                result.current.toggleShortcuts();
            });

            expect(result.current.isEnabled).toBe(true);
        });
    });

    describe('Show Help', () => {
        it('setShowHelp updates showHelp state', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            expect(result.current.showHelp).toBe(false);

            act(() => {
                result.current.setShowHelp(true);
            });

            expect(result.current.showHelp).toBe(true);

            act(() => {
                result.current.setShowHelp(false);
            });

            expect(result.current.showHelp).toBe(false);
        });
    });

    describe('Keyboard Event Handling', () => {
        it('triggers action on key press', () => {
            const onCreateTask = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onCreateTask
            }));

            const event = new KeyboardEvent('keydown', {
                key: 'c',
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(onCreateTask).toHaveBeenCalled();
        });

        it('triggers navigation on g + key sequence', async () => {
            vi.useFakeTimers();
            const onNavigate = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onNavigate
            }));

            // Press 'g'
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));

            // Press 'f' within timeout
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));

            expect(onNavigate).toHaveBeenCalledWith('focus');

            vi.useRealTimers();
        });

        it('does not trigger navigation if timeout expires', async () => {
            vi.useFakeTimers();
            const onNavigate = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onNavigate
            }));

            // Press 'g'
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));

            // Wait for timeout to expire
            vi.advanceTimersByTime(1100);

            // Press 'f' after timeout
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));

            expect(onNavigate).not.toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('ignores shortcuts when typing in input', () => {
            const onCreateTask = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onCreateTask
            }));

            // Create an input element
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            const event = new KeyboardEvent('keydown', {
                key: 'c',
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: input });
            document.dispatchEvent(event);

            expect(onCreateTask).not.toHaveBeenCalled();

            document.body.removeChild(input);
        });

        it('allows Escape in input fields', () => {
            const onCloseModal = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onCloseModal
            }));

            // Create an input element
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: input });
            document.dispatchEvent(event);

            expect(onCloseModal).toHaveBeenCalled();

            document.body.removeChild(input);
        });

        it('does not trigger when disabled', () => {
            const onCreateTask = vi.fn();

            const { result } = renderHook(() => useKeyboardShortcuts({
                onCreateTask
            }));

            act(() => {
                result.current.toggleShortcuts();
            });

            const event = new KeyboardEvent('keydown', {
                key: 'c',
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(onCreateTask).not.toHaveBeenCalled();
        });

        it('handles shift modifier', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            const event = new KeyboardEvent('keydown', {
                key: '?',
                shiftKey: true,
                bubbles: true
            });
            document.dispatchEvent(event);

            // This should trigger help modal
            expect(result.current.showHelp).toBe(true);
        });

        it('triggers focus search on /', () => {
            const onFocusSearch = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onFocusSearch
            }));

            const event = new KeyboardEvent('keydown', {
                key: '/',
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(onFocusSearch).toHaveBeenCalled();
        });

        it('triggers close modal on Escape', () => {
            const onCloseModal = vi.fn();

            renderHook(() => useKeyboardShortcuts({
                onCloseModal
            }));

            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(onCloseModal).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        it('removes event listener on unmount', () => {
            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

            const { unmount } = renderHook(() => useKeyboardShortcuts());

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });
    });

    describe('Shortcut Descriptions', () => {
        it('provides description for each shortcut', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            result.current.allShortcuts.forEach(shortcut => {
                expect(shortcut.description).toBeDefined();
                expect(shortcut.description.length).toBeGreaterThan(0);
            });
        });

        it('provides category for each shortcut', () => {
            const { result } = renderHook(() => useKeyboardShortcuts());

            result.current.allShortcuts.forEach(shortcut => {
                expect(shortcut.category).toBeDefined();
            });
        });
    });
});









