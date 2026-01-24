/**
 * Undo/Redo State Management Tests
 * Tests for undo/redo and history patterns
 *
 * @module tests/state/undo-redo.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Undo/Redo manager implementation
const createUndoRedoManager = (options = {}) => {
  const { maxHistory = 100 } = options;
  const past = [];
  const future = [];
  let current = null;
  const listeners = [];

  const emit = () => {
    listeners.forEach((fn) =>
      fn({
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        historyLength: past.length,
      })
    );
  };

  return {
    init: (state) => {
      current = structuredClone(state);
      past.length = 0;
      future.length = 0;
      emit();
    },

    push: (state) => {
      if (current !== null) {
        past.push(current);
        if (past.length > maxHistory) {
          past.shift();
        }
      }
      current = structuredClone(state);
      future.length = 0;
      emit();
    },

    undo: () => {
      if (past.length === 0) return null;

      future.push(current);
      current = past.pop();
      emit();
      return structuredClone(current);
    },

    redo: () => {
      if (future.length === 0) return null;

      past.push(current);
      current = future.pop();
      emit();
      return structuredClone(current);
    },

    getCurrent: () => structuredClone(current),

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    getHistoryLength: () => past.length,
    getFutureLength: () => future.length,

    clear: () => {
      past.length = 0;
      future.length = 0;
      emit();
    },

    onChange: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },

    // Get states for history view
    getHistory: () => [...past],
    getFuture: () => [...future].reverse(),
  };
};

// Checkpoint-based history
const createCheckpointManager = () => {
  const checkpoints = new Map();
  let autoSaveInterval = null;

  return {
    save: (name, state) => {
      checkpoints.set(name, {
        state: structuredClone(state),
        savedAt: Date.now(),
      });
    },

    restore: (name) => {
      const checkpoint = checkpoints.get(name);
      return checkpoint ? structuredClone(checkpoint.state) : null;
    },

    exists: (name) => checkpoints.has(name),

    delete: (name) => checkpoints.delete(name),

    list: () =>
      [...checkpoints.entries()].map(([name, data]) => ({
        name,
        savedAt: data.savedAt,
      })),

    clear: () => checkpoints.clear(),

    startAutoSave: (name, getState, interval = 60000) => {
      this.stopAutoSave();
      autoSaveInterval = setInterval(() => {
        this.save(`${name}-auto`, getState());
      }, interval);
    },

    stopAutoSave: () => {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
      }
    },
  };
};

// Diff-based history (memory efficient)
const createDiffHistory = () => {
  const diffs = [];
  let baseState = null;
  let maxDiffs = 50;

  const computeDiff = (from, to) => {
    const changes = [];

    const findChanges = (fromObj, toObj, path = '') => {
      const allKeys = new Set([...Object.keys(fromObj || {}), ...Object.keys(toObj || {})]);

      for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const fromVal = fromObj?.[key];
        const toVal = toObj?.[key];

        if (fromVal !== toVal) {
          if (
            typeof fromVal === 'object' &&
            typeof toVal === 'object' &&
            fromVal !== null &&
            toVal !== null
          ) {
            findChanges(fromVal, toVal, currentPath);
          } else {
            changes.push({ path: currentPath, from: fromVal, to: toVal });
          }
        }
      }
    };

    findChanges(from, to);
    return changes;
  };

  const applyDiff = (state, diff, reverse = false) => {
    const result = structuredClone(state);

    for (const change of diff) {
      const parts = change.path.split('.');
      let obj = result;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }

      obj[parts[parts.length - 1]] = reverse ? change.from : change.to;
    }

    return result;
  };

  return {
    init: (state) => {
      baseState = structuredClone(state);
      diffs.length = 0;
    },

    push: (newState) => {
      const currentState = this.getCurrent();
      const diff = computeDiff(currentState, newState);

      if (diff.length > 0) {
        diffs.push({
          changes: diff,
          timestamp: Date.now(),
        });

        if (diffs.length > maxDiffs) {
          // Compact: apply oldest diff to base and remove it
          baseState = applyDiff(baseState, diffs.shift().changes);
        }
      }
    },

    undo: () => {
      if (diffs.length === 0) return null;

      const diff = diffs.pop();
      return this.getCurrent();
    },

    getCurrent: () => {
      let state = structuredClone(baseState);
      for (const diff of diffs) {
        state = applyDiff(state, diff.changes);
      }
      return state;
    },

    getHistoryLength: () => diffs.length,

    canUndo: () => diffs.length > 0,
  };
};

// Batch/transaction support
const createBatchManager = (undoRedoManager) => {
  let batchStart = null;
  let batchOperations = [];

  return {
    startBatch: () => {
      batchStart = undoRedoManager.getCurrent();
      batchOperations = [];
    },

    addOperation: (state) => {
      batchOperations.push(state);
    },

    commitBatch: () => {
      if (batchOperations.length > 0) {
        // Only save final state as single history entry
        undoRedoManager.push(batchOperations[batchOperations.length - 1]);
      }
      batchStart = null;
      batchOperations = [];
    },

    cancelBatch: () => {
      batchStart = null;
      batchOperations = [];
      return undoRedoManager.getCurrent();
    },

    isInBatch: () => batchStart !== null,
  };
};

describe('Undo/Redo Manager Tests', () => {
  let manager;

  beforeEach(() => {
    manager = createUndoRedoManager();
    manager.init({ value: 0 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PUSH / CURRENT
  // ═══════════════════════════════════════════════════════════════════

  describe('push / current', () => {
    it('should push state', () => {
      manager.push({ value: 1 });

      expect(manager.getCurrent().value).toBe(1);
    });

    it('should track history', () => {
      manager.push({ value: 1 });
      manager.push({ value: 2 });

      expect(manager.getHistoryLength()).toBe(2);
    });

    it('should limit history size', () => {
      const limitedManager = createUndoRedoManager({ maxHistory: 3 });
      limitedManager.init({ value: 0 });

      for (let i = 1; i <= 10; i++) {
        limitedManager.push({ value: i });
      }

      expect(limitedManager.getHistoryLength()).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UNDO / REDO
  // ═══════════════════════════════════════════════════════════════════

  describe('undo / redo', () => {
    it('should undo', () => {
      manager.push({ value: 1 });
      manager.push({ value: 2 });

      const state = manager.undo();

      expect(state.value).toBe(1);
    });

    it('should redo', () => {
      manager.push({ value: 1 });
      manager.push({ value: 2 });
      manager.undo();

      const state = manager.redo();

      expect(state.value).toBe(2);
    });

    it('should clear future on push', () => {
      manager.push({ value: 1 });
      manager.push({ value: 2 });
      manager.undo();
      manager.push({ value: 3 });

      expect(manager.canRedo()).toBe(false);
    });

    it('should report canUndo/canRedo', () => {
      expect(manager.canUndo()).toBe(false);

      manager.push({ value: 1 });
      expect(manager.canUndo()).toBe(true);

      manager.undo();
      expect(manager.canRedo()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('events', () => {
    it('should notify on change', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.push({ value: 1 });

      expect(handler).toHaveBeenCalled();
    });
  });
});

describe('Checkpoint Manager Tests', () => {
  let checkpoints;

  beforeEach(() => {
    checkpoints = createCheckpointManager();
  });

  it('should save and restore checkpoint', () => {
    checkpoints.save('v1', { data: 'test' });

    const restored = checkpoints.restore('v1');
    expect(restored.data).toBe('test');
  });

  it('should list checkpoints', () => {
    checkpoints.save('v1', {});
    checkpoints.save('v2', {});

    const list = checkpoints.list();
    expect(list.length).toBe(2);
  });

  it('should delete checkpoint', () => {
    checkpoints.save('v1', {});
    checkpoints.delete('v1');

    expect(checkpoints.exists('v1')).toBe(false);
  });

  it('should return null for non-existent', () => {
    expect(checkpoints.restore('nonexistent')).toBeNull();
  });
});

describe('Diff History Tests', () => {
  let diffHistory;

  beforeEach(() => {
    diffHistory = createDiffHistory();
    diffHistory.init({ a: 1, b: 2 });
  });

  it('should track changes', () => {
    diffHistory.push({ a: 1, b: 3 });

    expect(diffHistory.getCurrent().b).toBe(3);
  });

  it('should undo', () => {
    diffHistory.push({ a: 2, b: 2 });
    diffHistory.undo();

    expect(diffHistory.getCurrent().a).toBe(1);
  });

  it('should handle nested changes', () => {
    diffHistory.init({ nested: { value: 1 } });
    diffHistory.push({ nested: { value: 2 } });

    expect(diffHistory.getCurrent().nested.value).toBe(2);
  });
});

describe('Batch Manager Tests', () => {
  let undoRedo;
  let batchManager;

  beforeEach(() => {
    undoRedo = createUndoRedoManager();
    undoRedo.init({ value: 0 });
    batchManager = createBatchManager(undoRedo);
  });

  it('should batch operations', () => {
    batchManager.startBatch();
    batchManager.addOperation({ value: 1 });
    batchManager.addOperation({ value: 2 });
    batchManager.addOperation({ value: 3 });
    batchManager.commitBatch();

    // Should only create one history entry
    expect(undoRedo.getHistoryLength()).toBe(1);
    expect(undoRedo.getCurrent().value).toBe(3);
  });

  it('should cancel batch', () => {
    batchManager.startBatch();
    batchManager.addOperation({ value: 100 });
    batchManager.cancelBatch();

    expect(undoRedo.getCurrent().value).toBe(0);
  });

  it('should report batch status', () => {
    expect(batchManager.isInBatch()).toBe(false);

    batchManager.startBatch();
    expect(batchManager.isInBatch()).toBe(true);

    batchManager.commitBatch();
    expect(batchManager.isInBatch()).toBe(false);
  });
});
