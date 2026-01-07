/**
 * Keyboard Utilities Tests
 * Tests for keyboard navigation and shortcuts
 * 
 * @module tests/keyboard/keyboard-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Keyboard shortcut manager
const createShortcutManager = () => {
    const shortcuts = new Map();
    let isEnabled = true;

    const normalizeKey = (key) => {
        return key
            .toLowerCase()
            .split('+')
            .sort()
            .join('+');
    };

    const eventToKey = (e) => {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        parts.push(e.key.toLowerCase());
        return parts.sort().join('+');
    };

    return {
        register: (key, handler, options = {}) => {
            const normalizedKey = normalizeKey(key);
            shortcuts.set(normalizedKey, {
                handler,
                description: options.description || '',
                preventDefault: options.preventDefault !== false,
            });
        },

        unregister: (key) => {
            shortcuts.delete(normalizeKey(key));
        },

        handleKeyDown: (e) => {
            if (!isEnabled) return false;

            const key = eventToKey(e);
            const shortcut = shortcuts.get(key);

            if (shortcut) {
                if (shortcut.preventDefault) {
                    e.preventDefault?.();
                }
                shortcut.handler(e);
                return true;
            }

            return false;
        },

        enable: () => {
            isEnabled = true;
        },

        disable: () => {
            isEnabled = false;
        },

        isEnabled: () => isEnabled,

        getShortcuts: () => {
            const result = [];
            for (const [key, { description }] of shortcuts) {
                result.push({ key, description });
            }
            return result;
        },

        hasShortcut: (key) => shortcuts.has(normalizeKey(key)),

        clear: () => {
            shortcuts.clear();
        },
    };
};

// Key combo detector
const createComboDetector = (options = {}) => {
    const { timeout = 1000, separator = ' ' } = options;

    let buffer = '';
    let lastKeyTime = 0;
    const combos = new Map();

    return {
        register: (combo, handler) => {
            combos.set(combo, handler);
        },

        handleKey: (key) => {
            const now = Date.now();

            if (now - lastKeyTime > timeout) {
                buffer = '';
            }

            buffer += (buffer ? separator : '') + key;
            lastKeyTime = now;

            if (combos.has(buffer)) {
                combos.get(buffer)();
                buffer = '';
                return true;
            }

            // Check if buffer could still match
            for (const combo of combos.keys()) {
                if (combo.startsWith(buffer)) {
                    return false; // Still waiting
                }
            }

            // No possible match, reset
            buffer = '';
            return false;
        },

        getBuffer: () => buffer,

        reset: () => {
            buffer = '';
        },
    };
};

// Input mode detector
const createInputModeDetector = () => {
    let currentMode = 'keyboard';
    const listeners = [];

    const notify = () => {
        listeners.forEach(fn => fn(currentMode));
    };

    return {
        handleKeyDown: () => {
            if (currentMode !== 'keyboard') {
                currentMode = 'keyboard';
                notify();
            }
        },

        handleMouseMove: () => {
            if (currentMode !== 'mouse') {
                currentMode = 'mouse';
                notify();
            }
        },

        handleTouchStart: () => {
            if (currentMode !== 'touch') {
                currentMode = 'touch';
                notify();
            }
        },

        getMode: () => currentMode,

        isKeyboard: () => currentMode === 'keyboard',

        isMouse: () => currentMode === 'mouse',

        isTouch: () => currentMode === 'touch',

        onChange: (callback) => {
            listeners.push(callback);
            return () => {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) listeners.splice(idx, 1);
            };
        },

        setMode: (mode) => {
            if (currentMode !== mode) {
                currentMode = mode;
                notify();
            }
        },
    };
};

// Focus order manager
const createFocusOrder = (elements = []) => {
    let index = -1;

    return {
        setElements: (els) => {
            elements = [...els];
            index = -1;
        },

        next: () => {
            if (elements.length === 0) return null;
            index = (index + 1) % elements.length;
            return elements[index];
        },

        previous: () => {
            if (elements.length === 0) return null;
            index = index <= 0 ? elements.length - 1 : index - 1;
            return elements[index];
        },

        first: () => {
            if (elements.length === 0) return null;
            index = 0;
            return elements[0];
        },

        last: () => {
            if (elements.length === 0) return null;
            index = elements.length - 1;
            return elements[index];
        },

        getCurrent: () => elements[index] || null,

        getCurrentIndex: () => index,

        getCount: () => elements.length,

        jumpTo: (i) => {
            if (i >= 0 && i < elements.length) {
                index = i;
                return elements[index];
            }
            return null;
        },
    };
};

// Hotkey display formatter
const createHotkeyFormatter = (os = 'mac') => {
    const symbols = os === 'mac' ? {
        ctrl: '⌘',
        alt: '⌥',
        shift: '⇧',
        enter: '↵',
        backspace: '⌫',
        escape: 'Esc',
        tab: '⇥',
        up: '↑',
        down: '↓',
        left: '←',
        right: '→',
    } : {
        ctrl: 'Ctrl',
        alt: 'Alt',
        shift: 'Shift',
        enter: 'Enter',
        backspace: 'Backspace',
        escape: 'Esc',
        tab: 'Tab',
        up: '↑',
        down: '↓',
        left: '←',
        right: '→',
    };

    return {
        format: (shortcut) => {
            return shortcut
                .split('+')
                .map(key => symbols[key.toLowerCase()] || key.toUpperCase())
                .join(os === 'mac' ? '' : '+');
        },

        getSymbol: (key) => symbols[key.toLowerCase()] || key,

        setOS: (newOS) => {
            // In real impl would update symbols
        },
    };
};

describe('Shortcut Manager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = createShortcutManager();
    });

    it('should register shortcut', () => {
        manager.register('ctrl+s', vi.fn());

        expect(manager.hasShortcut('ctrl+s')).toBe(true);
    });

    it('should handle keydown', () => {
        const handler = vi.fn();
        manager.register('ctrl+s', handler);

        const event = { ctrlKey: true, key: 's', preventDefault: vi.fn() };
        manager.handleKeyDown(event);

        expect(handler).toHaveBeenCalled();
    });

    it('should normalize key order', () => {
        manager.register('s+ctrl', vi.fn());

        expect(manager.hasShortcut('ctrl+s')).toBe(true);
    });

    it('should unregister shortcut', () => {
        manager.register('ctrl+s', vi.fn());
        manager.unregister('ctrl+s');

        expect(manager.hasShortcut('ctrl+s')).toBe(false);
    });

    it('should disable/enable', () => {
        const handler = vi.fn();
        manager.register('ctrl+s', handler);
        manager.disable();

        manager.handleKeyDown({ ctrlKey: true, key: 's' });

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('Combo Detector Tests', () => {
    let detector;

    beforeEach(() => {
        detector = createComboDetector({ timeout: 500 });
    });

    it('should detect combo', () => {
        const handler = vi.fn();
        detector.register('g g', handler);

        detector.handleKey('g');
        detector.handleKey('g');

        expect(handler).toHaveBeenCalled();
    });

    it('should reset after timeout', () => {
        vi.useFakeTimers();

        detector.register('a b', vi.fn());
        detector.handleKey('a');

        vi.advanceTimersByTime(600);

        detector.handleKey('b');

        expect(detector.getBuffer()).toBe('b');

        vi.useRealTimers();
    });
});

describe('Input Mode Detector Tests', () => {
    let detector;

    beforeEach(() => {
        detector = createInputModeDetector();
    });

    it('should start in keyboard mode', () => {
        expect(detector.getMode()).toBe('keyboard');
    });

    it('should switch to mouse', () => {
        detector.handleMouseMove();

        expect(detector.isMouse()).toBe(true);
    });

    it('should switch to touch', () => {
        detector.handleTouchStart();

        expect(detector.isTouch()).toBe(true);
    });

    it('should notify on change', () => {
        const callback = vi.fn();
        detector.onChange(callback);

        detector.handleMouseMove();

        expect(callback).toHaveBeenCalledWith('mouse');
    });
});

describe('Focus Order Tests', () => {
    let focusOrder;

    beforeEach(() => {
        focusOrder = createFocusOrder(['a', 'b', 'c']);
    });

    it('should navigate next', () => {
        expect(focusOrder.next()).toBe('a');
        expect(focusOrder.next()).toBe('b');
    });

    it('should wrap around', () => {
        focusOrder.last();
        expect(focusOrder.next()).toBe('a');
    });

    it('should navigate previous', () => {
        focusOrder.last();
        expect(focusOrder.previous()).toBe('b');
    });
});

describe('Hotkey Formatter Tests', () => {
    it('should format mac shortcuts', () => {
        const formatter = createHotkeyFormatter('mac');

        expect(formatter.format('ctrl+s')).toBe('⌘S');
    });

    it('should format windows shortcuts', () => {
        const formatter = createHotkeyFormatter('windows');

        expect(formatter.format('ctrl+s')).toBe('Ctrl+S');
    });
});
