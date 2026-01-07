/**
 * Keyboard Shortcuts Tests
 * Tests for keyboard shortcut management
 * 
 * @module tests/ui/keyboard-shortcuts.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Keyboard shortcut manager implementation
const createShortcutManager = () => {
    const shortcuts = new Map();
    const contexts = new Map();
    let activeContext = 'global';
    let enabled = true;

    const normalizeKey = (key) => key.toLowerCase().trim();

    const parseShortcut = (shortcut) => {
        const parts = shortcut.toLowerCase().split('+').map(p => p.trim());
        return {
            key: parts[parts.length - 1],
            ctrl: parts.includes('ctrl') || parts.includes('control'),
            shift: parts.includes('shift'),
            alt: parts.includes('alt'),
            meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
        };
    };

    const matchesEvent = (parsed, event) => {
        return (
            normalizeKey(event.key) === parsed.key &&
            event.ctrlKey === parsed.ctrl &&
            event.shiftKey === parsed.shift &&
            event.altKey === parsed.alt &&
            event.metaKey === parsed.meta
        );
    };

    return {
        register: (shortcut, handler, options = {}) => {
            const { context = 'global', description = '', priority = 0 } = options;
            const parsed = parseShortcut(shortcut);
            const id = `${context}:${shortcut}`;

            shortcuts.set(id, {
                id,
                shortcut,
                parsed,
                handler,
                context,
                description,
                priority,
                enabled: true,
            });

            if (!contexts.has(context)) {
                contexts.set(context, []);
            }
            contexts.get(context).push(id);

            return () => this.unregister(shortcut, context);
        },

        unregister: (shortcut, context = 'global') => {
            const id = `${context}:${shortcut}`;
            shortcuts.delete(id);

            const contextShortcuts = contexts.get(context);
            if (contextShortcuts) {
                const index = contextShortcuts.indexOf(id);
                if (index !== -1) contextShortcuts.splice(index, 1);
            }
        },

        handle: (event) => {
            if (!enabled) return false;

            // Get shortcuts for active context and global
            const contextShortcuts = contexts.get(activeContext) || [];
            const globalShortcuts = contexts.get('global') || [];

            // Combine and sort by priority
            const candidates = [...contextShortcuts, ...globalShortcuts]
                .map(id => shortcuts.get(id))
                .filter(s => s && s.enabled)
                .sort((a, b) => b.priority - a.priority);

            for (const shortcut of candidates) {
                if (matchesEvent(shortcut.parsed, event)) {
                    shortcut.handler(event);
                    return true;
                }
            }

            return false;
        },

        setContext: (context) => {
            activeContext = context;
        },

        getContext: () => activeContext,

        enable: () => { enabled = true; },

        disable: () => { enabled = false; },

        isEnabled: () => enabled,

        enableShortcut: (shortcut, context = 'global') => {
            const s = shortcuts.get(`${context}:${shortcut}`);
            if (s) s.enabled = true;
        },

        disableShortcut: (shortcut, context = 'global') => {
            const s = shortcuts.get(`${context}:${shortcut}`);
            if (s) s.enabled = false;
        },

        getShortcuts: (context) => {
            if (context) {
                return (contexts.get(context) || [])
                    .map(id => shortcuts.get(id))
                    .filter(Boolean);
            }
            return [...shortcuts.values()];
        },

        getShortcut: (shortcut, context = 'global') => {
            return shortcuts.get(`${context}:${shortcut}`);
        },
    };
};

// Shortcut recorder
const createShortcutRecorder = () => {
    let recording = false;
    let recorded = null;
    let callback = null;

    return {
        start: (onRecord) => {
            recording = true;
            recorded = null;
            callback = onRecord;
        },

        stop: () => {
            recording = false;
            callback = null;
            return recorded;
        },

        isRecording: () => recording,

        handleEvent: (event) => {
            if (!recording) return false;

            // Build shortcut string
            const parts = [];
            if (event.ctrlKey) parts.push('Ctrl');
            if (event.shiftKey) parts.push('Shift');
            if (event.altKey) parts.push('Alt');
            if (event.metaKey) parts.push('Cmd');

            // Ignore modifier-only keys
            const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];
            if (!modifierKeys.includes(event.key)) {
                parts.push(event.key.toUpperCase());
                recorded = parts.join('+');
                callback?.(recorded);
                return true;
            }

            return false;
        },

        getRecorded: () => recorded,
    };
};

// Shortcut conflict detector
const createConflictDetector = () => {
    return {
        detect: (shortcuts) => {
            const conflicts = [];
            const seen = new Map();

            for (const shortcut of shortcuts) {
                const key = `${shortcut.context}:${shortcut.shortcut.toLowerCase()}`;

                if (seen.has(key)) {
                    conflicts.push({
                        shortcut: shortcut.shortcut,
                        context: shortcut.context,
                        existing: seen.get(key),
                        conflicting: shortcut,
                    });
                } else {
                    seen.set(key, shortcut);
                }
            }

            // Check global conflicts with context shortcuts
            for (const shortcut of shortcuts) {
                if (shortcut.context !== 'global') {
                    const globalKey = `global:${shortcut.shortcut.toLowerCase()}`;
                    if (seen.has(globalKey)) {
                        conflicts.push({
                            shortcut: shortcut.shortcut,
                            context: shortcut.context,
                            existing: seen.get(globalKey),
                            conflicting: shortcut,
                            type: 'global-override',
                        });
                    }
                }
            }

            return conflicts;
        },

        hasConflict: (shortcuts, newShortcut) => {
            return shortcuts.some(
                s => s.shortcut.toLowerCase() === newShortcut.shortcut.toLowerCase() &&
                    (s.context === newShortcut.context || s.context === 'global' || newShortcut.context === 'global')
            );
        },
    };
};

// Shortcut display helper
const createShortcutDisplay = () => {
    const symbols = {
        ctrl: '⌃',
        shift: '⇧',
        alt: '⌥',
        meta: '⌘',
        cmd: '⌘',
        enter: '↵',
        backspace: '⌫',
        delete: '⌦',
        escape: '⎋',
        tab: '⇥',
        arrowup: '↑',
        arrowdown: '↓',
        arrowleft: '←',
        arrowright: '→',
    };

    return {
        format: (shortcut, style = 'symbols') => {
            const parts = shortcut.toLowerCase().split('+').map(p => p.trim());

            if (style === 'symbols') {
                return parts.map(p => symbols[p] || p.toUpperCase()).join('');
            }

            if (style === 'verbose') {
                return parts.map(p => {
                    if (p === 'ctrl') return 'Control';
                    if (p === 'cmd' || p === 'meta') return 'Command';
                    return p.charAt(0).toUpperCase() + p.slice(1);
                }).join(' + ');
            }

            return shortcut;
        },

        parse: (displayString) => {
            // Reverse lookup
            const reverseSymbols = Object.fromEntries(
                Object.entries(symbols).map(([k, v]) => [v, k])
            );

            let result = displayString;
            for (const [symbol, key] of Object.entries(reverseSymbols)) {
                result = result.replace(symbol, key + '+');
            }

            return result.replace(/\+$/, '').toLowerCase();
        },
    };
};

describe('Shortcut Manager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = createShortcutManager();
    });

    // ═══════════════════════════════════════════════════════════════════
    // REGISTER / UNREGISTER
    // ═══════════════════════════════════════════════════════════════════

    describe('register / unregister', () => {
        it('should register shortcut', () => {
            manager.register('Ctrl+S', () => { });

            expect(manager.getShortcut('Ctrl+S')).toBeDefined();
        });

        it('should unregister shortcut', () => {
            manager.register('Ctrl+S', () => { });
            manager.unregister('Ctrl+S');

            expect(manager.getShortcut('Ctrl+S')).toBeUndefined();
        });

        it('should return unsubscribe function', () => {
            const unsubscribe = manager.register('Ctrl+S', () => { });
            unsubscribe();

            expect(manager.getShortcut('Ctrl+S')).toBeUndefined();
        });

        it('should store description', () => {
            manager.register('Ctrl+S', () => { }, { description: 'Save file' });

            expect(manager.getShortcut('Ctrl+S').description).toBe('Save file');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HANDLE
    // ═══════════════════════════════════════════════════════════════════

    describe('handle', () => {
        it('should call handler on match', () => {
            const handler = vi.fn();
            manager.register('Ctrl+S', handler);

            const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            const handled = manager.handle(event);

            expect(handled).toBe(true);
            expect(handler).toHaveBeenCalled();
        });

        it('should not call handler when disabled', () => {
            const handler = vi.fn();
            manager.register('Ctrl+S', handler);
            manager.disable();

            const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            manager.handle(event);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should respect context', () => {
            const globalHandler = vi.fn();
            const editorHandler = vi.fn();

            manager.register('Ctrl+S', globalHandler);
            manager.register('Ctrl+S', editorHandler, { context: 'editor' });

            manager.setContext('editor');

            const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            manager.handle(event);

            expect(editorHandler).toHaveBeenCalled();
        });

        it('should respect priority', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            manager.register('Ctrl+S', handler1, { priority: 1 });
            manager.register('Ctrl+S', handler2, { context: 'other', priority: 10 });

            manager.setContext('other');

            const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            manager.handle(event);

            expect(handler2).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CONTEXT
    // ═══════════════════════════════════════════════════════════════════

    describe('context', () => {
        it('should set context', () => {
            manager.setContext('editor');

            expect(manager.getContext()).toBe('editor');
        });

        it('should get shortcuts by context', () => {
            manager.register('Ctrl+S', () => { });
            manager.register('Ctrl+E', () => { }, { context: 'editor' });
            manager.register('Ctrl+D', () => { }, { context: 'editor' });

            const editorShortcuts = manager.getShortcuts('editor');

            expect(editorShortcuts.length).toBe(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENABLE / DISABLE
    // ═══════════════════════════════════════════════════════════════════

    describe('enable / disable', () => {
        it('should disable single shortcut', () => {
            const handler = vi.fn();
            manager.register('Ctrl+S', handler);
            manager.disableShortcut('Ctrl+S');

            const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            manager.handle(event);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should re-enable shortcut', () => {
            const handler = vi.fn();
            manager.register('Ctrl+S', handler);
            manager.disableShortcut('Ctrl+S');
            manager.enableShortcut('Ctrl+S');

            const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
            manager.handle(event);

            expect(handler).toHaveBeenCalled();
        });
    });
});

describe('Shortcut Recorder Tests', () => {
    let recorder;

    beforeEach(() => {
        recorder = createShortcutRecorder();
    });

    it('should record shortcut', () => {
        const callback = vi.fn();
        recorder.start(callback);

        recorder.handleEvent({ key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false });

        expect(callback).toHaveBeenCalledWith('Ctrl+S');
    });

    it('should ignore modifier-only keys', () => {
        const callback = vi.fn();
        recorder.start(callback);

        recorder.handleEvent({ key: 'Control', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should combine multiple modifiers', () => {
        const callback = vi.fn();
        recorder.start(callback);

        recorder.handleEvent({ key: 's', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false });

        expect(callback).toHaveBeenCalledWith('Ctrl+Shift+S');
    });

    it('should stop recording', () => {
        recorder.start(() => { });
        const recorded = recorder.stop();

        expect(recorder.isRecording()).toBe(false);
    });
});

describe('Conflict Detector Tests', () => {
    let detector;

    beforeEach(() => {
        detector = createConflictDetector();
    });

    it('should detect duplicate shortcuts', () => {
        const shortcuts = [
            { shortcut: 'Ctrl+S', context: 'global' },
            { shortcut: 'Ctrl+S', context: 'global' },
        ];

        const conflicts = detector.detect(shortcuts);

        expect(conflicts.length).toBe(1);
    });

    it('should detect global override', () => {
        const shortcuts = [
            { shortcut: 'Ctrl+S', context: 'global' },
            { shortcut: 'Ctrl+S', context: 'editor' },
        ];

        const conflicts = detector.detect(shortcuts);

        expect(conflicts.some(c => c.type === 'global-override')).toBe(true);
    });

    it('should check for conflict', () => {
        const shortcuts = [
            { shortcut: 'Ctrl+S', context: 'global' },
        ];

        expect(detector.hasConflict(shortcuts, { shortcut: 'Ctrl+S', context: 'global' })).toBe(true);
        expect(detector.hasConflict(shortcuts, { shortcut: 'Ctrl+D', context: 'global' })).toBe(false);
    });
});

describe('Shortcut Display Tests', () => {
    let display;

    beforeEach(() => {
        display = createShortcutDisplay();
    });

    it('should format with symbols', () => {
        const formatted = display.format('Ctrl+Shift+S', 'symbols');

        expect(formatted).toContain('⌃');
        expect(formatted).toContain('⇧');
    });

    it('should format verbose', () => {
        const formatted = display.format('Ctrl+S', 'verbose');

        expect(formatted).toBe('Control + S');
    });

    it('should format special keys', () => {
        const formatted = display.format('Ctrl+Enter', 'symbols');

        expect(formatted).toContain('↵');
    });
});
