/**
 * Mock Utilities Tests
 * Tests for mocking patterns and utilities
 * 
 * @module tests/testing/mocks.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Spy factory with call tracking
const createSpy = (implementation) => {
    const calls = [];
    let mockImplementation = implementation;
    let returnValue;
    let throwError;

    const spy = (...args) => {
        const call = {
            args,
            timestamp: Date.now(),
            thisArg: spy.boundThis,
        };
        calls.push(call);

        if (throwError) {
            const error = throwError;
            throwError = null;
            throw error;
        }

        if (returnValue !== undefined) {
            return returnValue;
        }

        if (mockImplementation) {
            return mockImplementation(...args);
        }
    };

    spy.calls = calls;
    spy.callCount = () => calls.length;
    spy.getCall = (index) => calls[index];
    spy.lastCall = () => calls[calls.length - 1];
    spy.wasCalledWith = (...expectedArgs) => {
        return calls.some(call =>
            expectedArgs.every((arg, i) => arg === call.args[i])
        );
    };
    spy.reset = () => {
        calls.length = 0;
        returnValue = undefined;
        throwError = null;
    };
    spy.mockReturnValue = (value) => {
        returnValue = value;
        return spy;
    };
    spy.mockImplementation = (fn) => {
        mockImplementation = fn;
        return spy;
    };
    spy.mockThrow = (error) => {
        throwError = error;
        return spy;
    };
    spy.mockClear = () => {
        calls.length = 0;
    };

    return spy;
};

// Mock object factory
const createMockObject = (methods) => {
    const mock = {};
    const spies = new Map();

    for (const [name, impl] of Object.entries(methods)) {
        const spy = createSpy(impl);
        mock[name] = spy;
        spies.set(name, spy);
    }

    mock._getSpy = (name) => spies.get(name);
    mock._resetAll = () => spies.forEach(spy => spy.reset());
    mock._verifyAll = () => {
        const results = {};
        spies.forEach((spy, name) => {
            results[name] = spy.callCount();
        });
        return results;
    };

    return mock;
};

// Timer mock
const createTimerMock = () => {
    let currentTime = 0;
    const timers = [];
    let nextId = 1;

    return {
        now: () => currentTime,

        setTimeout: (callback, delay) => {
            const id = nextId++;
            timers.push({
                id,
                callback,
                executeAt: currentTime + delay,
                type: 'timeout',
            });
            return id;
        },

        setInterval: (callback, interval) => {
            const id = nextId++;
            timers.push({
                id,
                callback,
                executeAt: currentTime + interval,
                interval,
                type: 'interval',
            });
            return id;
        },

        clearTimeout: (id) => {
            const index = timers.findIndex(t => t.id === id);
            if (index !== -1) timers.splice(index, 1);
        },

        clearInterval: (id) => {
            const index = timers.findIndex(t => t.id === id);
            if (index !== -1) timers.splice(index, 1);
        },

        advanceBy: (ms) => {
            const targetTime = currentTime + ms;

            while (currentTime < targetTime) {
                // Find next timer
                const pending = timers
                    .filter(t => t.executeAt <= targetTime)
                    .sort((a, b) => a.executeAt - b.executeAt);

                if (pending.length === 0) {
                    currentTime = targetTime;
                    break;
                }

                const next = pending[0];
                currentTime = next.executeAt;
                next.callback();

                if (next.type === 'interval') {
                    next.executeAt = currentTime + next.interval;
                } else {
                    const index = timers.indexOf(next);
                    timers.splice(index, 1);
                }
            }
        },

        runAllTimers: () => {
            while (timers.length > 0) {
                const next = timers.reduce((min, t) =>
                    t.executeAt < min.executeAt ? t : min
                );
                currentTime = next.executeAt;
                next.callback();

                if (next.type === 'interval') {
                    next.executeAt = currentTime + next.interval;
                } else {
                    const index = timers.indexOf(next);
                    timers.splice(index, 1);
                }
            }
        },

        reset: () => {
            currentTime = 0;
            timers.length = 0;
            nextId = 1;
        },

        getPendingTimers: () => timers.length,
    };
};

// Fetch mock
const createFetchMock = () => {
    const handlers = [];
    const calls = [];
    let defaultResponse = { status: 200, body: {} };

    const mockFetch = async (url, options = {}) => {
        calls.push({ url, options, timestamp: Date.now() });

        const handler = handlers.find(h => {
            if (typeof h.matcher === 'string') return url.includes(h.matcher);
            if (h.matcher instanceof RegExp) return h.matcher.test(url);
            if (typeof h.matcher === 'function') return h.matcher(url, options);
            return false;
        });

        const response = handler?.response || defaultResponse;

        if (response.error) {
            throw response.error;
        }

        if (response.delay) {
            await new Promise(r => setTimeout(r, response.delay));
        }

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText || 'OK',
            headers: new Map(Object.entries(response.headers || {})),
            json: async () => response.body,
            text: async () => JSON.stringify(response.body),
            clone: () => ({ ...this }),
        };
    };

    mockFetch.when = (matcher) => {
        const handler = { matcher, response: { status: 200, body: {} } };
        handlers.push(handler);

        return {
            respond: (body, status = 200) => {
                handler.response = { status, body };
                return mockFetch;
            },
            reject: (error) => {
                handler.response = { error };
                return mockFetch;
            },
            delay: (ms) => {
                handler.response.delay = ms;
                return mockFetch;
            },
        };
    };

    mockFetch.setDefault = (response) => {
        defaultResponse = response;
    };

    mockFetch.getCalls = () => [...calls];
    mockFetch.getLastCall = () => calls[calls.length - 1];
    mockFetch.reset = () => {
        handlers.length = 0;
        calls.length = 0;
    };

    return mockFetch;
};

// Storage mock
const createStorageMock = () => {
    const store = new Map();

    return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (index) => [...store.keys()][index] ?? null,
        _getAll: () => Object.fromEntries(store),
    };
};

describe('Spy Factory Tests', () => {
    it('should track calls', () => {
        const spy = createSpy();

        spy('a', 'b');
        spy('c');

        expect(spy.callCount()).toBe(2);
        expect(spy.getCall(0).args).toEqual(['a', 'b']);
    });

    it('should check if called with args', () => {
        const spy = createSpy();

        spy(1, 2, 3);
        spy('test');

        expect(spy.wasCalledWith(1, 2, 3)).toBe(true);
        expect(spy.wasCalledWith('test')).toBe(true);
        expect(spy.wasCalledWith('nope')).toBe(false);
    });

    it('should mock return value', () => {
        const spy = createSpy().mockReturnValue(42);

        expect(spy()).toBe(42);
        expect(spy('any', 'args')).toBe(42);
    });

    it('should mock implementation', () => {
        const spy = createSpy().mockImplementation((a, b) => a + b);

        expect(spy(2, 3)).toBe(5);
    });

    it('should mock throw', () => {
        const spy = createSpy().mockThrow(new Error('Test error'));

        expect(() => spy()).toThrow('Test error');
    });

    it('should reset spy', () => {
        const spy = createSpy().mockReturnValue(100);
        spy();
        spy.reset();

        expect(spy.callCount()).toBe(0);
        expect(spy()).toBeUndefined();
    });
});

describe('Mock Object Tests', () => {
    it('should create mock with methods', () => {
        const mock = createMockObject({
            save: () => true,
            load: (id) => ({ id }),
        });

        expect(mock.save()).toBe(true);
        expect(mock.load(5).id).toBe(5);
    });

    it('should track method calls', () => {
        const mock = createMockObject({
            method: () => { },
        });

        mock.method('a');
        mock.method('b');

        expect(mock._getSpy('method').callCount()).toBe(2);
    });

    it('should verify all methods', () => {
        const mock = createMockObject({
            a: () => { },
            b: () => { },
        });

        mock.a();
        mock.b();
        mock.b();

        const calls = mock._verifyAll();
        expect(calls.a).toBe(1);
        expect(calls.b).toBe(2);
    });
});

describe('Timer Mock Tests', () => {
    let timers;

    beforeEach(() => {
        timers = createTimerMock();
    });

    it('should mock setTimeout', () => {
        const callback = vi.fn();

        timers.setTimeout(callback, 1000);
        timers.advanceBy(500);
        expect(callback).not.toHaveBeenCalled();

        timers.advanceBy(500);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should mock setInterval', () => {
        const callback = vi.fn();

        timers.setInterval(callback, 100);
        timers.advanceBy(350);

        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should clear timers', () => {
        const callback = vi.fn();
        const id = timers.setTimeout(callback, 1000);

        timers.clearTimeout(id);
        timers.advanceBy(2000);

        expect(callback).not.toHaveBeenCalled();
    });

    it('should run all timers', () => {
        const callbacks = [vi.fn(), vi.fn(), vi.fn()];

        timers.setTimeout(callbacks[0], 100);
        timers.setTimeout(callbacks[1], 200);
        timers.setTimeout(callbacks[2], 300);

        timers.runAllTimers();

        callbacks.forEach(cb => expect(cb).toHaveBeenCalledTimes(1));
    });
});

describe('Fetch Mock Tests', () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = createFetchMock();
    });

    it('should mock fetch responses', async () => {
        fetchMock.when('/api/users').respond([{ id: 1 }]);

        const response = await fetchMock('/api/users');
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data).toEqual([{ id: 1 }]);
    });

    it('should match with regex', async () => {
        fetchMock.when(/\/api\/user\/\d+/).respond({ name: 'Test' });

        const response = await fetchMock('/api/user/123');
        expect(response.ok).toBe(true);
    });

    it('should reject requests', async () => {
        fetchMock.when('/api/error').reject(new Error('Network error'));

        await expect(fetchMock('/api/error')).rejects.toThrow('Network error');
    });

    it('should track calls', async () => {
        await fetchMock('/api/a', { method: 'GET' });
        await fetchMock('/api/b', { method: 'POST' });

        const calls = fetchMock.getCalls();
        expect(calls.length).toBe(2);
        expect(calls[0].url).toBe('/api/a');
        expect(calls[1].options.method).toBe('POST');
    });
});

describe('Storage Mock Tests', () => {
    let storage;

    beforeEach(() => {
        storage = createStorageMock();
    });

    it('should set and get items', () => {
        storage.setItem('key', 'value');
        expect(storage.getItem('key')).toBe('value');
    });

    it('should return null for missing', () => {
        expect(storage.getItem('missing')).toBeNull();
    });

    it('should remove items', () => {
        storage.setItem('key', 'value');
        storage.removeItem('key');
        expect(storage.getItem('key')).toBeNull();
    });

    it('should clear all', () => {
        storage.setItem('a', '1');
        storage.setItem('b', '2');
        storage.clear();
        expect(storage.length).toBe(0);
    });

    it('should get key by index', () => {
        storage.setItem('first', '1');
        storage.setItem('second', '2');
        expect(storage.key(0)).toBeTruthy();
    });
});
