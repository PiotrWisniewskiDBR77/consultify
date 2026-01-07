/**
 * Browser Storage Manager Tests
 * Tests for localStorage, sessionStorage, and storage quota management
 * 
 * @module tests/browser/storageManager.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// HELPER IMPLEMENTATIONS (inline mocks)
// ============================================

/**
 * Creates an in-memory storage mock
 */
const createStorageMock = () => {
    let store = {};
    let quotaLimit = 5 * 1024 * 1024; // 5MB default

    const getUsedSpace = () => {
        return Object.entries(store).reduce((acc, [key, value]) => {
            return acc + key.length + value.length;
        }, 0);
    };

    return {
        getItem: (key) => store[key] || null,

        setItem: (key, value) => {
            const newSize = getUsedSpace() - (store[key]?.length || 0) + value.length + key.length;
            if (newSize > quotaLimit) {
                throw new Error('QuotaExceededError');
            }
            store[key] = String(value);
        },

        removeItem: (key) => {
            delete store[key];
        },

        clear: () => {
            store = {};
        },

        key: (index) => Object.keys(store)[index] || null,

        get length() {
            return Object.keys(store).length;
        },

        // Test helpers
        _getUsedSpace: getUsedSpace,
        _setQuotaLimit: (limit) => { quotaLimit = limit; },
        _getQuotaLimit: () => quotaLimit
    };
};

/**
 * Creates a storage manager with namespace support
 */
const createStorageManager = (storage) => {
    const namespace = 'app';
    const listeners = new Map();

    const prefixKey = (key) => `${namespace}:${key}`;

    return {
        get: (key) => {
            const raw = storage.getItem(prefixKey(key));
            if (raw === null) return null;
            try {
                const parsed = JSON.parse(raw);
                if (parsed.expires && Date.now() > parsed.expires) {
                    storage.removeItem(prefixKey(key));
                    return null;
                }
                return parsed.value;
            } catch {
                return raw;
            }
        },

        set: (key, value, options = {}) => {
            const data = {
                value,
                timestamp: Date.now()
            };
            if (options.ttl) {
                data.expires = Date.now() + options.ttl;
            }
            storage.setItem(prefixKey(key), JSON.stringify(data));

            // Notify listeners
            listeners.get(key)?.forEach(cb => cb(value));

            return true;
        },

        remove: (key) => {
            storage.removeItem(prefixKey(key));
            return true;
        },

        has: (key) => {
            return storage.getItem(prefixKey(key)) !== null;
        },

        getAll: () => {
            const result = {};
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key?.startsWith(`${namespace}:`)) {
                    const shortKey = key.slice(namespace.length + 1);
                    result[shortKey] = storage.getItem(key);
                }
            }
            return result;
        },

        clear: () => {
            const keysToRemove = [];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key?.startsWith(`${namespace}:`)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => storage.removeItem(key));
        },

        subscribe: (key, callback) => {
            if (!listeners.has(key)) listeners.set(key, []);
            listeners.get(key).push(callback);
            return () => {
                const cbs = listeners.get(key);
                const idx = cbs?.indexOf(callback);
                if (idx > -1) cbs.splice(idx, 1);
            };
        },

        getSize: () => storage._getUsedSpace(),
        getQuota: () => storage._getQuotaLimit()
    };
};

/**
 * Creates a session manager for complex session data
 */
const createSessionManager = (storage) => {
    const SESSION_KEY = 'session';

    return {
        create: (data) => {
            const session = {
                id: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                data
            };
            storage.setItem(SESSION_KEY, JSON.stringify(session));
            return session;
        },

        get: () => {
            const raw = storage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        },

        update: (data) => {
            const session = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
            if (!session) return null;
            session.data = { ...session.data, ...data };
            session.lastActivity = Date.now();
            storage.setItem(SESSION_KEY, JSON.stringify(session));
            return session;
        },

        touch: () => {
            const session = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
            if (!session) return null;
            session.lastActivity = Date.now();
            storage.setItem(SESSION_KEY, JSON.stringify(session));
            return session;
        },

        destroy: () => {
            storage.removeItem(SESSION_KEY);
        },

        isValid: (maxAge = 30 * 60 * 1000) => {
            const session = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
            if (!session) return false;
            return Date.now() - session.lastActivity < maxAge;
        }
    };
};

/**
 * Creates a history state manager
 */
const createHistoryManager = () => {
    const stack = [];
    let currentIndex = -1;
    const listeners = [];

    return {
        push: (state, title = '', url = '') => {
            // Remove any forward history
            stack.splice(currentIndex + 1);
            stack.push({ state, title, url, timestamp: Date.now() });
            currentIndex = stack.length - 1;
            listeners.forEach(cb => cb({ type: 'push', state }));
            return currentIndex;
        },

        replace: (state, title = '', url = '') => {
            if (currentIndex >= 0) {
                stack[currentIndex] = { state, title, url, timestamp: Date.now() };
            }
            listeners.forEach(cb => cb({ type: 'replace', state }));
        },

        back: () => {
            if (currentIndex > 0) {
                currentIndex--;
                const entry = stack[currentIndex];
                listeners.forEach(cb => cb({ type: 'popstate', state: entry.state }));
                return entry;
            }
            return null;
        },

        forward: () => {
            if (currentIndex < stack.length - 1) {
                currentIndex++;
                const entry = stack[currentIndex];
                listeners.forEach(cb => cb({ type: 'popstate', state: entry.state }));
                return entry;
            }
            return null;
        },

        go: (delta) => {
            const newIndex = currentIndex + delta;
            if (newIndex >= 0 && newIndex < stack.length) {
                currentIndex = newIndex;
                return stack[currentIndex];
            }
            return null;
        },

        getCurrent: () => stack[currentIndex] || null,
        getLength: () => stack.length,
        getIndex: () => currentIndex,

        canGoBack: () => currentIndex > 0,
        canGoForward: () => currentIndex < stack.length - 1,

        onPopState: (callback) => {
            listeners.push(callback);
            return () => {
                const idx = listeners.indexOf(callback);
                if (idx > -1) listeners.splice(idx, 1);
            };
        },

        getStack: () => [...stack],
        clear: () => { stack.length = 0; currentIndex = -1; }
    };
};

// ============================================
// TESTS
// ============================================

describe('Browser Storage Manager Tests', () => {
    let storageMock;
    let storageManager;
    let sessionManager;
    let historyManager;

    beforeEach(() => {
        storageMock = createStorageMock();
        storageManager = createStorageManager(storageMock);
        sessionManager = createSessionManager(storageMock);
        historyManager = createHistoryManager();
        vi.useFakeTimers();
    });

    afterEach(() => {
        storageMock.clear();
        vi.useRealTimers();
    });

    describe('Storage Mock', () => {
        it('should set and get items', () => {
            storageMock.setItem('key1', 'value1');
            expect(storageMock.getItem('key1')).toBe('value1');
        });

        it('should return null for non-existent keys', () => {
            expect(storageMock.getItem('nonexistent')).toBeNull();
        });

        it('should remove items', () => {
            storageMock.setItem('key', 'value');
            storageMock.removeItem('key');
            expect(storageMock.getItem('key')).toBeNull();
        });

        it('should clear all items', () => {
            storageMock.setItem('a', '1');
            storageMock.setItem('b', '2');
            storageMock.clear();
            expect(storageMock.length).toBe(0);
        });

        it('should track storage length', () => {
            storageMock.setItem('a', '1');
            storageMock.setItem('b', '2');
            expect(storageMock.length).toBe(2);
        });

        it('should throw on quota exceeded', () => {
            storageMock._setQuotaLimit(10); // 10 bytes
            expect(() => storageMock.setItem('key', 'a'.repeat(20))).toThrow('QuotaExceededError');
        });
    });

    describe('Storage Manager', () => {
        it('should store and retrieve values with namespace prefix', () => {
            storageManager.set('user', { name: 'John' });
            expect(storageManager.get('user')).toEqual({ name: 'John' });
            expect(storageMock.getItem('app:user')).toBeTruthy();
        });

        it('should handle TTL expiration', () => {
            storageManager.set('temp', 'data', { ttl: 1000 });
            expect(storageManager.get('temp')).toBe('data');

            vi.advanceTimersByTime(1500);
            expect(storageManager.get('temp')).toBeNull();
        });

        it('should check if key exists', () => {
            storageManager.set('exists', true);
            expect(storageManager.has('exists')).toBe(true);
            expect(storageManager.has('notexists')).toBe(false);
        });

        it('should remove items', () => {
            storageManager.set('toRemove', 'value');
            storageManager.remove('toRemove');
            expect(storageManager.get('toRemove')).toBeNull();
        });

        it('should get all namespaced items', () => {
            storageManager.set('a', 1);
            storageManager.set('b', 2);
            storageMock.setItem('other:c', '3'); // Different namespace

            const all = storageManager.getAll();
            expect(Object.keys(all)).toHaveLength(2);
            expect('a' in all).toBe(true);
            expect('b' in all).toBe(true);
        });

        it('should clear only namespaced items', () => {
            storageManager.set('a', 1);
            storageMock.setItem('other:b', '2');

            storageManager.clear();
            expect(storageManager.get('a')).toBeNull();
            expect(storageMock.getItem('other:b')).toBe('2');
        });

        it('should notify subscribers on change', () => {
            const callback = vi.fn();
            storageManager.subscribe('watched', callback);

            storageManager.set('watched', 'newValue');
            expect(callback).toHaveBeenCalledWith('newValue');
        });

        it('should unsubscribe correctly', () => {
            const callback = vi.fn();
            const unsubscribe = storageManager.subscribe('key', callback);

            storageManager.set('key', 'v1');
            unsubscribe();
            storageManager.set('key', 'v2');

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('Session Manager', () => {
        it('should create session with unique ID', () => {
            const session = sessionManager.create({ userId: 123 });

            expect(session.id).toMatch(/^sess-/);
            expect(session.data.userId).toBe(123);
            expect(session.createdAt).toBeDefined();
        });

        it('should retrieve session', () => {
            sessionManager.create({ token: 'abc' });
            const session = sessionManager.get();

            expect(session.data.token).toBe('abc');
        });

        it('should update session data', () => {
            sessionManager.create({ a: 1 });
            sessionManager.update({ b: 2 });

            const session = sessionManager.get();
            expect(session.data).toEqual({ a: 1, b: 2 });
        });

        it('should touch session to update activity', () => {
            sessionManager.create({});
            const original = sessionManager.get().lastActivity;

            vi.advanceTimersByTime(1000);
            sessionManager.touch();

            expect(sessionManager.get().lastActivity).toBeGreaterThan(original);
        });

        it('should destroy session', () => {
            sessionManager.create({});
            sessionManager.destroy();

            expect(sessionManager.get()).toBeNull();
        });

        it('should validate session age', () => {
            sessionManager.create({});
            expect(sessionManager.isValid(60000)).toBe(true);

            vi.advanceTimersByTime(120000);
            expect(sessionManager.isValid(60000)).toBe(false);
        });
    });

    describe('History Manager', () => {
        it('should push state to history', () => {
            historyManager.push({ page: 'home' });
            historyManager.push({ page: 'about' });

            expect(historyManager.getLength()).toBe(2);
            expect(historyManager.getCurrent().state.page).toBe('about');
        });

        it('should navigate back', () => {
            historyManager.push({ page: 'a' });
            historyManager.push({ page: 'b' });

            historyManager.back();
            expect(historyManager.getCurrent().state.page).toBe('a');
        });

        it('should navigate forward', () => {
            historyManager.push({ page: 'a' });
            historyManager.push({ page: 'b' });
            historyManager.back();
            historyManager.forward();

            expect(historyManager.getCurrent().state.page).toBe('b');
        });

        it('should replace current state', () => {
            historyManager.push({ v: 1 });
            historyManager.replace({ v: 2 });

            expect(historyManager.getLength()).toBe(1);
            expect(historyManager.getCurrent().state.v).toBe(2);
        });

        it('should emit popstate events', () => {
            const listener = vi.fn();
            historyManager.onPopState(listener);

            historyManager.push({ page: 'a' });
            historyManager.push({ page: 'b' });
            historyManager.back();

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'popstate' }));
        });

        it('should check navigation availability', () => {
            historyManager.push({ page: 'a' });
            expect(historyManager.canGoBack()).toBe(false);

            historyManager.push({ page: 'b' });
            expect(historyManager.canGoBack()).toBe(true);
            expect(historyManager.canGoForward()).toBe(false);
        });

        it('should clear forward history on new push', () => {
            historyManager.push({ page: 'a' });
            historyManager.push({ page: 'b' });
            historyManager.push({ page: 'c' });
            historyManager.back();
            historyManager.back();
            historyManager.push({ page: 'd' });

            expect(historyManager.getLength()).toBe(2);
            expect(historyManager.canGoForward()).toBe(false);
        });
    });
});
