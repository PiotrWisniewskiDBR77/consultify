/**
 * State Persistence Tests
 * Tests for state persistence and storage patterns
 *
 * @module tests/state/persistence.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Storage adapter interface
const createLocalStorageAdapter = () => {
  const storage = new Map();

  return {
    type: 'localStorage',

    get: async (key) => {
      const value = storage.get(key);
      return value !== undefined ? JSON.parse(value) : null;
    },

    set: async (key, value) => {
      storage.set(key, JSON.stringify(value));
    },

    remove: async (key) => {
      storage.delete(key);
    },

    clear: async () => {
      storage.clear();
    },

    keys: async () => [...storage.keys()],

    has: async (key) => storage.has(key),
  };
};

// IndexedDB-like adapter
const createIndexedDBAdapter = (dbName, storeName = 'default') => {
  const stores = new Map();
  stores.set(storeName, new Map());

  return {
    type: 'indexedDB',
    dbName,
    storeName,

    get: async (key) => {
      const store = stores.get(storeName);
      return store?.get(key) ?? null;
    },

    set: async (key, value) => {
      const store = stores.get(storeName);
      store?.set(key, structuredClone(value));
    },

    remove: async (key) => {
      const store = stores.get(storeName);
      store?.delete(key);
    },

    clear: async () => {
      const store = stores.get(storeName);
      store?.clear();
    },

    getAll: async () => {
      const store = stores.get(storeName);
      return [...(store?.values() ?? [])];
    },

    getAllKeys: async () => {
      const store = stores.get(storeName);
      return [...(store?.keys() ?? [])];
    },

    count: async () => {
      const store = stores.get(storeName);
      return store?.size ?? 0;
    },
  };
};

// Persistence manager with versioning
const createPersistenceManager = (adapter, options = {}) => {
  const { version = 1, migrations = {} } = options;
  const META_KEY = '__persistence_meta__';

  const getMeta = async () => {
    const meta = await adapter.get(META_KEY);
    return meta || { version: 0, lastSaved: null };
  };

  const setMeta = async (updates) => {
    const current = await getMeta();
    await adapter.set(META_KEY, { ...current, ...updates });
  };

  const runMigrations = async (fromVersion, toVersion, state) => {
    let migrated = state;

    for (let v = fromVersion + 1; v <= toVersion; v++) {
      const migration = migrations[v];
      if (migration) {
        migrated = await migration(migrated);
      }
    }

    return migrated;
  };

  return {
    save: async (key, state) => {
      await adapter.set(key, state);
      await setMeta({ lastSaved: Date.now(), version });
    },

    load: async (key) => {
      const meta = await getMeta();
      let state = await adapter.get(key);

      if (state && meta.version < version) {
        state = await runMigrations(meta.version, version, state);
        await adapter.set(key, state);
        await setMeta({ version });
      }

      return state;
    },

    remove: async (key) => {
      await adapter.remove(key);
    },

    clear: async () => {
      await adapter.clear();
    },

    getVersion: async () => {
      const meta = await getMeta();
      return meta.version;
    },

    getLastSaved: async () => {
      const meta = await getMeta();
      return meta.lastSaved;
    },
  };
};

// Auto-save manager
const createAutoSave = (persistenceManager, key, options = {}) => {
  const { debounceMs = 1000, onSave, onError } = options;
  let timer = null;
  let pendingState = null;

  const flush = async () => {
    if (pendingState !== null) {
      try {
        await persistenceManager.save(key, pendingState);
        onSave?.(pendingState);
      } catch (error) {
        onError?.(error);
      }
      pendingState = null;
    }
  };

  return {
    save: (state) => {
      pendingState = state;

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(flush, debounceMs);
    },

    flush,

    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pendingState = null;
    },

    hasPending: () => pendingState !== null,
  };
};

// Encrypted storage wrapper
const createEncryptedStorage = (adapter, encrypt, decrypt) => {
  return {
    ...adapter,
    type: 'encrypted',

    get: async (key) => {
      const encrypted = await adapter.get(key);
      if (encrypted === null) return null;
      return decrypt(encrypted);
    },

    set: async (key, value) => {
      const encrypted = encrypt(value);
      await adapter.set(key, encrypted);
    },
  };
};

describe('LocalStorage Adapter Tests', () => {
  let adapter;

  beforeEach(() => {
    adapter = createLocalStorageAdapter();
  });

  it('should set and get value', async () => {
    await adapter.set('key1', { data: 'test' });
    const value = await adapter.get('key1');

    expect(value.data).toBe('test');
  });

  it('should return null for missing key', async () => {
    const value = await adapter.get('missing');
    expect(value).toBeNull();
  });

  it('should remove value', async () => {
    await adapter.set('key1', 'value');
    await adapter.remove('key1');

    expect(await adapter.get('key1')).toBeNull();
  });

  it('should clear all values', async () => {
    await adapter.set('key1', 'value1');
    await adapter.set('key2', 'value2');
    await adapter.clear();

    const keys = await adapter.keys();
    expect(keys.length).toBe(0);
  });

  it('should list keys', async () => {
    await adapter.set('a', 1);
    await adapter.set('b', 2);

    const keys = await adapter.keys();
    expect(keys).toContain('a');
    expect(keys).toContain('b');
  });
});

describe('IndexedDB Adapter Tests', () => {
  let adapter;

  beforeEach(() => {
    adapter = createIndexedDBAdapter('testDB', 'testStore');
  });

  it('should set and get value', async () => {
    await adapter.set('key1', { nested: { value: 42 } });
    const value = await adapter.get('key1');

    expect(value.nested.value).toBe(42);
  });

  it('should get all values', async () => {
    await adapter.set('a', { id: 1 });
    await adapter.set('b', { id: 2 });

    const all = await adapter.getAll();
    expect(all.length).toBe(2);
  });

  it('should count entries', async () => {
    await adapter.set('a', 1);
    await adapter.set('b', 2);
    await adapter.set('c', 3);

    const count = await adapter.count();
    expect(count).toBe(3);
  });
});

describe('Persistence Manager Tests', () => {
  let adapter;
  let manager;

  beforeEach(() => {
    adapter = createLocalStorageAdapter();
    manager = createPersistenceManager(adapter, { version: 1 });
  });

  it('should save and load state', async () => {
    await manager.save('app', { count: 10 });
    const state = await manager.load('app');

    expect(state.count).toBe(10);
  });

  it('should track version', async () => {
    await manager.save('app', {});
    const version = await manager.getVersion();

    expect(version).toBe(1);
  });

  it('should track last saved time', async () => {
    const before = Date.now();
    await manager.save('app', {});
    const lastSaved = await manager.getLastSaved();

    expect(lastSaved).toBeGreaterThanOrEqual(before);
  });

  it('should run migrations', async () => {
    // Save with version 1
    await manager.save('app', { oldField: 'value' });

    // Create new manager with migration
    const migratedManager = createPersistenceManager(adapter, {
      version: 2,
      migrations: {
        2: (state) => ({
          ...state,
          newField: state.oldField,
          oldField: undefined,
        }),
      },
    });

    const state = await migratedManager.load('app');
    expect(state.newField).toBe('value');
  });
});

describe('AutoSave Tests', () => {
  let adapter;
  let manager;
  let autoSave;

  beforeEach(() => {
    vi.useFakeTimers();
    adapter = createLocalStorageAdapter();
    manager = createPersistenceManager(adapter);
    autoSave = createAutoSave(manager, 'app', { debounceMs: 500 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce saves', async () => {
    autoSave.save({ count: 1 });
    autoSave.save({ count: 2 });
    autoSave.save({ count: 3 });

    // Before debounce
    let state = await manager.load('app');
    expect(state).toBeNull();

    // After debounce
    await vi.advanceTimersByTimeAsync(600);
    state = await manager.load('app');
    expect(state.count).toBe(3);
  });

  it('should flush immediately', async () => {
    autoSave.save({ data: 'important' });
    await autoSave.flush();

    const state = await manager.load('app');
    expect(state.data).toBe('important');
  });

  it('should cancel pending save', async () => {
    autoSave.save({ data: 'test' });
    autoSave.cancel();

    await vi.advanceTimersByTimeAsync(1000);

    const state = await manager.load('app');
    expect(state).toBeNull();
  });

  it('should report pending state', () => {
    expect(autoSave.hasPending()).toBe(false);

    autoSave.save({ data: 'test' });
    expect(autoSave.hasPending()).toBe(true);
  });
});

describe('Encrypted Storage Tests', () => {
  it('should encrypt and decrypt', async () => {
    const adapter = createLocalStorageAdapter();

    // Simple mock encryption
    const encrypt = (value) => btoa(JSON.stringify(value));
    const decrypt = (encrypted) => JSON.parse(atob(encrypted));

    const encrypted = createEncryptedStorage(adapter, encrypt, decrypt);

    await encrypted.set('secret', { password: '12345' });
    const value = await encrypted.get('secret');

    expect(value.password).toBe('12345');
  });

  it('should return null for missing', async () => {
    const adapter = createLocalStorageAdapter();
    const encrypted = createEncryptedStorage(
      adapter,
      (v) => v,
      (v) => v
    );

    const value = await encrypted.get('missing');
    expect(value).toBeNull();
  });
});
