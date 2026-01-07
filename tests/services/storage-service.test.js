/**
 * Storage Service Tests
 * Tests for local/session storage service
 * 
 * @module tests/services/storage-service.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
class MockStorage {
    constructor() {
        this.store = new Map();
    }

    getItem(key) {
        return this.store.get(key) || null;
    }

    setItem(key, value) {
        this.store.set(key, String(value));
    }

    removeItem(key) {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }

    get length() {
        return this.store.size;
    }

    key(index) {
        return Array.from(this.store.keys())[index];
    }
}

// Create storage service
const createStorageService = (storage) => {
    const PREFIX = 'app_';

    return {
        get: (key, defaultValue = null) => {
            try {
                const item = storage.getItem(PREFIX + key);
                if (item === null) return defaultValue;
                return JSON.parse(item);
            } catch {
                return defaultValue;
            }
        },
        set: (key, value) => {
            try {
                storage.setItem(PREFIX + key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },
        remove: (key) => {
            storage.removeItem(PREFIX + key);
        },
        clear: () => {
            // Only clear items with our prefix
            const keysToRemove = [];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => storage.removeItem(key));
        },
        has: (key) => {
            return storage.getItem(PREFIX + key) !== null;
        },
        getAll: () => {
            const result = {};
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(PREFIX)) {
                    const cleanKey = key.slice(PREFIX.length);
                    try {
                        result[cleanKey] = JSON.parse(storage.getItem(key));
                    } catch {
                        result[cleanKey] = storage.getItem(key);
                    }
                }
            }
            return result;
        },
        setWithExpiry: (key, value, ttlMs) => {
            const item = {
                value,
                expiry: Date.now() + ttlMs,
            };
            storage.setItem(PREFIX + key, JSON.stringify(item));
        },
        getWithExpiry: (key, defaultValue = null) => {
            try {
                const item = storage.getItem(PREFIX + key);
                if (item === null) return defaultValue;

                const parsed = JSON.parse(item);

                // Check if it has expiry
                if (parsed && typeof parsed === 'object' && 'expiry' in parsed) {
                    if (Date.now() > parsed.expiry) {
                        storage.removeItem(PREFIX + key);
                        return defaultValue;
                    }
                    return parsed.value;
                }

                return parsed;
            } catch {
                return defaultValue;
            }
        },
    };
};

describe('Storage Service Tests', () => {
    let mockStorage;
    let storageService;

    beforeEach(() => {
        mockStorage = new MockStorage();
        storageService = createStorageService(mockStorage);
    });

    // ═══════════════════════════════════════════════════════════════════
    // BASIC GET/SET
    // ═══════════════════════════════════════════════════════════════════

    describe('Basic Get/Set', () => {
        it('should set and get string value', () => {
            storageService.set('name', 'John');
            expect(storageService.get('name')).toBe('John');
        });

        it('should set and get object value', () => {
            const user = { id: 1, name: 'John' };
            storageService.set('user', user);
            expect(storageService.get('user')).toEqual(user);
        });

        it('should set and get array value', () => {
            const items = [1, 2, 3];
            storageService.set('items', items);
            expect(storageService.get('items')).toEqual(items);
        });

        it('should set and get boolean value', () => {
            storageService.set('enabled', true);
            expect(storageService.get('enabled')).toBe(true);
        });

        it('should set and get number value', () => {
            storageService.set('count', 42);
            expect(storageService.get('count')).toBe(42);
        });

        it('should return default value for missing key', () => {
            expect(storageService.get('missing', 'default')).toBe('default');
        });

        it('should return null for missing key without default', () => {
            expect(storageService.get('missing')).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REMOVE
    // ═══════════════════════════════════════════════════════════════════

    describe('Remove', () => {
        it('should remove item', () => {
            storageService.set('temp', 'value');
            storageService.remove('temp');
            expect(storageService.get('temp')).toBeNull();
        });

        it('should not throw on removing non-existent key', () => {
            expect(() => storageService.remove('nonexistent')).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLEAR
    // ═══════════════════════════════════════════════════════════════════

    describe('Clear', () => {
        it('should clear all items with prefix', () => {
            storageService.set('key1', 'value1');
            storageService.set('key2', 'value2');
            storageService.clear();

            expect(storageService.get('key1')).toBeNull();
            expect(storageService.get('key2')).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HAS
    // ═══════════════════════════════════════════════════════════════════

    describe('Has', () => {
        it('should return true for existing key', () => {
            storageService.set('exists', 'value');
            expect(storageService.has('exists')).toBe(true);
        });

        it('should return false for missing key', () => {
            expect(storageService.has('missing')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET ALL
    // ═══════════════════════════════════════════════════════════════════

    describe('Get All', () => {
        it('should get all stored items', () => {
            storageService.set('key1', 'value1');
            storageService.set('key2', 'value2');

            const all = storageService.getAll();

            expect(all).toEqual({
                key1: 'value1',
                key2: 'value2',
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EXPIRY
    // ═══════════════════════════════════════════════════════════════════

    describe('Expiry', () => {
        it('should get value before expiry', () => {
            storageService.setWithExpiry('temp', 'value', 10000);
            expect(storageService.getWithExpiry('temp')).toBe('value');
        });

        it('should return default after expiry', async () => {
            storageService.setWithExpiry('temp', 'value', 1); // 1ms

            // Wait for expiry
            await new Promise(r => setTimeout(r, 10));

            expect(storageService.getWithExpiry('temp', 'default')).toBe('default');
        });

        it('should remove expired items on access', async () => {
            storageService.setWithExpiry('temp', 'value', 1);

            await new Promise(r => setTimeout(r, 10));

            storageService.getWithExpiry('temp');
            expect(mockStorage.getItem('app_temp')).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should handle invalid JSON gracefully', () => {
            mockStorage.setItem('app_invalid', 'not{json');
            expect(storageService.get('invalid', 'default')).toBe('default');
        });

        it('should return false on storage error', () => {
            const badStorage = {
                setItem: () => { throw new Error('Quota exceeded'); },
                getItem: () => null,
            };
            const badService = createStorageService(badStorage);

            expect(badService.set('key', 'value')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PREFIXING
    // ═══════════════════════════════════════════════════════════════════

    describe('Prefixing', () => {
        it('should prefix all keys', () => {
            storageService.set('test', 'value');

            expect(mockStorage.getItem('app_test')).not.toBeNull();
            expect(mockStorage.getItem('test')).toBeNull();
        });
    });
});
