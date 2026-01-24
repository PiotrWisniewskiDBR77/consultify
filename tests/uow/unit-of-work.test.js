/**
 * Unit of Work Pattern Tests
 * Tests for transaction management
 *
 * @module tests/uow/unit-of-work.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Unit of Work
const createUnitOfWork = () => {
  const newEntities = [];
  const dirtyEntities = [];
  const removedEntities = [];
  const repositories = new Map();
  let committed = false;
  let rolledBack = false;

  return {
    registerNew: (entity) => {
      newEntities.push(entity);
    },

    registerDirty: (entity) => {
      if (!dirtyEntities.includes(entity) && !newEntities.includes(entity)) {
        dirtyEntities.push(entity);
      }
    },

    registerRemoved: (entity) => {
      if (newEntities.includes(entity)) {
        newEntities.splice(newEntities.indexOf(entity), 1);
      } else {
        removedEntities.push(entity);
      }
    },

    registerRepository: (name, repo) => {
      repositories.set(name, repo);
    },

    getRepository: (name) => repositories.get(name),

    commit: async () => {
      // Process in order: inserts, updates, deletes
      for (const entity of newEntities) {
        await entity._save?.();
      }

      for (const entity of dirtyEntities) {
        await entity._update?.();
      }

      for (const entity of removedEntities) {
        await entity._delete?.();
      }

      committed = true;
      newEntities.length = 0;
      dirtyEntities.length = 0;
      removedEntities.length = 0;
    },

    rollback: () => {
      newEntities.length = 0;
      dirtyEntities.length = 0;
      removedEntities.length = 0;
      rolledBack = true;
    },

    isCommitted: () => committed,

    isRolledBack: () => rolledBack,

    getNewCount: () => newEntities.length,

    getDirtyCount: () => dirtyEntities.length,

    getRemovedCount: () => removedEntities.length,

    hasChanges: () =>
      newEntities.length > 0 || dirtyEntities.length > 0 || removedEntities.length > 0,
  };
};

// Transaction manager
const createTransactionManager = () => {
  const transactions = new Map();
  let currentTx = null;

  return {
    begin: () => {
      const id = crypto.randomUUID();
      const tx = {
        id,
        operations: [],
        status: 'active',
        startedAt: Date.now(),
      };
      transactions.set(id, tx);
      currentTx = tx;
      return tx;
    },

    commit: async (txId) => {
      const tx = transactions.get(txId);
      if (!tx) throw new Error('Transaction not found');
      if (tx.status !== 'active') throw new Error('Transaction not active');

      try {
        for (const op of tx.operations) {
          await op.execute();
        }
        tx.status = 'committed';
      } catch (error) {
        tx.status = 'failed';
        throw error;
      }
    },

    rollback: async (txId) => {
      const tx = transactions.get(txId);
      if (!tx) throw new Error('Transaction not found');

      // Reverse operations
      for (let i = tx.operations.length - 1; i >= 0; i--) {
        const op = tx.operations[i];
        if (op.executed && op.compensate) {
          await op.compensate();
        }
      }

      tx.status = 'rolledback';
    },

    addOperation: (op) => {
      if (!currentTx) throw new Error('No active transaction');
      currentTx.operations.push(op);
    },

    getCurrent: () => currentTx,

    getTransaction: (id) => transactions.get(id),

    withTransaction: async (fn) => {
      const tx = this.begin();
      try {
        const result = await fn(tx);
        await this.commit(tx.id);
        return result;
      } catch (error) {
        await this.rollback(tx.id);
        throw error;
      }
    },
  };
};

// Change tracker (Identity Map)
const createChangeTracker = () => {
  const identityMap = new Map();
  const originalValues = new Map();

  return {
    track: (entity) => {
      const id = entity.id;
      identityMap.set(id, entity);
      originalValues.set(id, { ...entity });
    },

    get: (id) => identityMap.get(id),

    has: (id) => identityMap.has(id),

    getChanges: (entity) => {
      const original = originalValues.get(entity.id);
      if (!original) return {};

      const changes = {};
      for (const [key, value] of Object.entries(entity)) {
        if (original[key] !== value) {
          changes[key] = { from: original[key], to: value };
        }
      }
      return changes;
    },

    hasChanges: (entity) => {
      const changes = this.getChanges(entity);
      return Object.keys(changes).length > 0;
    },

    acceptChanges: (entity) => {
      originalValues.set(entity.id, { ...entity });
    },

    rejectChanges: (entity) => {
      const original = originalValues.get(entity.id);
      if (original) {
        Object.assign(entity, original);
      }
    },

    clear: () => {
      identityMap.clear();
      originalValues.clear();
    },
  };
};

describe('Unit of Work Tests', () => {
  let uow;

  beforeEach(() => {
    uow = createUnitOfWork();
  });

  it('should register new entities', () => {
    uow.registerNew({ id: 1, name: 'Test' });

    expect(uow.getNewCount()).toBe(1);
    expect(uow.hasChanges()).toBe(true);
  });

  it('should register dirty entities', () => {
    const entity = { id: 1, name: 'Test' };
    uow.registerDirty(entity);

    expect(uow.getDirtyCount()).toBe(1);
  });

  it('should register removed entities', () => {
    uow.registerRemoved({ id: 1 });

    expect(uow.getRemovedCount()).toBe(1);
  });

  it('should remove from new when registering removed', () => {
    const entity = { id: 1 };
    uow.registerNew(entity);
    uow.registerRemoved(entity);

    expect(uow.getNewCount()).toBe(0);
    expect(uow.getRemovedCount()).toBe(0);
  });

  it('should commit changes', async () => {
    const saveFn = vi.fn();
    uow.registerNew({ _save: saveFn });

    await uow.commit();

    expect(saveFn).toHaveBeenCalled();
    expect(uow.isCommitted()).toBe(true);
    expect(uow.hasChanges()).toBe(false);
  });

  it('should rollback changes', () => {
    uow.registerNew({ id: 1 });
    uow.registerDirty({ id: 2 });
    uow.rollback();

    expect(uow.isRolledBack()).toBe(true);
    expect(uow.hasChanges()).toBe(false);
  });
});

describe('Transaction Manager Tests', () => {
  let txManager;

  beforeEach(() => {
    txManager = createTransactionManager();
  });

  it('should begin transaction', () => {
    const tx = txManager.begin();

    expect(tx.id).toBeDefined();
    expect(tx.status).toBe('active');
  });

  it('should commit transaction', async () => {
    const tx = txManager.begin();
    const execute = vi.fn();
    txManager.addOperation({ execute });

    await txManager.commit(tx.id);

    expect(execute).toHaveBeenCalled();
    expect(txManager.getTransaction(tx.id).status).toBe('committed');
  });

  it('should rollback transaction', async () => {
    const tx = txManager.begin();
    const compensate = vi.fn();
    txManager.addOperation({ execute: vi.fn(), executed: true, compensate });

    await txManager.rollback(tx.id);

    expect(compensate).toHaveBeenCalled();
    expect(txManager.getTransaction(tx.id).status).toBe('rolledback');
  });

  it('should run with transaction', async () => {
    const result = await txManager.withTransaction(async () => {
      return 'done';
    });

    expect(result).toBe('done');
  });
});

describe('Change Tracker Tests', () => {
  let tracker;

  beforeEach(() => {
    tracker = createChangeTracker();
  });

  it('should track entity', () => {
    const entity = { id: 1, name: 'Test' };
    tracker.track(entity);

    expect(tracker.has(1)).toBe(true);
    expect(tracker.get(1)).toBe(entity);
  });

  it('should detect changes', () => {
    const entity = { id: 1, name: 'Old' };
    tracker.track(entity);

    entity.name = 'New';

    const changes = tracker.getChanges(entity);
    expect(changes.name).toEqual({ from: 'Old', to: 'New' });
    expect(tracker.hasChanges(entity)).toBe(true);
  });

  it('should accept changes', () => {
    const entity = { id: 1, name: 'Old' };
    tracker.track(entity);
    entity.name = 'New';

    tracker.acceptChanges(entity);

    expect(tracker.hasChanges(entity)).toBe(false);
  });

  it('should reject changes', () => {
    const entity = { id: 1, name: 'Old' };
    tracker.track(entity);
    entity.name = 'New';

    tracker.rejectChanges(entity);

    expect(entity.name).toBe('Old');
  });
});
