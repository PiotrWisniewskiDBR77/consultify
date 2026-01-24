/**
 * Repository Pattern Tests
 * Tests for data access abstraction
 *
 * @module tests/repository/repository-pattern.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Base repository
const createRepository = (storage = new Map()) => {
  return {
    findById: async (id) => {
      return storage.get(id) || null;
    },

    findAll: async (filter = {}) => {
      let results = [...storage.values()];

      for (const [key, value] of Object.entries(filter)) {
        results = results.filter((item) => item[key] === value);
      }

      return results;
    },

    findOne: async (filter) => {
      const results = await this.findAll(filter);
      return results[0] || null;
    },

    create: async (data) => {
      const id = data.id || crypto.randomUUID();
      const entity = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
      storage.set(id, entity);
      return entity;
    },

    update: async (id, data) => {
      const existing = storage.get(id);
      if (!existing) return null;

      const updated = { ...existing, ...data, updatedAt: new Date() };
      storage.set(id, updated);
      return updated;
    },

    delete: async (id) => {
      return storage.delete(id);
    },

    count: async (filter = {}) => {
      const results = await this.findAll(filter);
      return results.length;
    },

    exists: async (id) => {
      return storage.has(id);
    },

    clear: async () => {
      storage.clear();
    },
  };
};

// Query builder repository
const createQueryRepository = (data = []) => {
  let items = [...data];

  const query = () => {
    let result = [...items];
    let operations = [];

    const builder = {
      where: (field, op, value) => {
        operations.push({ type: 'where', field, op, value });
        return builder;
      },

      orderBy: (field, dir = 'asc') => {
        operations.push({ type: 'orderBy', field, dir });
        return builder;
      },

      limit: (n) => {
        operations.push({ type: 'limit', n });
        return builder;
      },

      offset: (n) => {
        operations.push({ type: 'offset', n });
        return builder;
      },

      select: (...fields) => {
        operations.push({ type: 'select', fields });
        return builder;
      },

      execute: () => {
        for (const op of operations) {
          switch (op.type) {
            case 'where':
              result = result.filter((item) => {
                const val = item[op.field];
                switch (op.op) {
                  case '=':
                    return val === op.value;
                  case '!=':
                    return val !== op.value;
                  case '>':
                    return val > op.value;
                  case '<':
                    return val < op.value;
                  case '>=':
                    return val >= op.value;
                  case '<=':
                    return val <= op.value;
                  case 'like':
                    return String(val).includes(op.value);
                  case 'in':
                    return op.value.includes(val);
                  default:
                    return true;
                }
              });
              break;
            case 'orderBy':
              result.sort((a, b) => {
                const aVal = a[op.field];
                const bVal = b[op.field];
                const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return op.dir === 'desc' ? -cmp : cmp;
              });
              break;
            case 'limit':
              result = result.slice(0, op.n);
              break;
            case 'offset':
              result = result.slice(op.n);
              break;
            case 'select':
              result = result.map((item) => {
                const picked = {};
                for (const f of op.fields) {
                  picked[f] = item[f];
                }
                return picked;
              });
              break;
          }
        }
        return result;
      },

      first: () => builder.execute()[0] || null,

      count: () => builder.execute().length,
    };

    return builder;
  };

  return {
    query,
    insert: (item) => {
      items.push(item);
    },
    getAll: () => [...items],
    clear: () => {
      items = [];
    },
  };
};

// Cached repository decorator
const createCachedRepository = (repo, ttlMs = 60000) => {
  const cache = new Map();

  const getCacheKey = (method, args) => `${method}:${JSON.stringify(args)}`;

  return {
    findById: async (id) => {
      const key = getCacheKey('findById', [id]);
      if (cache.has(key)) {
        const { value, expires } = cache.get(key);
        if (Date.now() < expires) return value;
      }

      const result = await repo.findById(id);
      cache.set(key, { value: result, expires: Date.now() + ttlMs });
      return result;
    },

    findAll: async (filter) => {
      const key = getCacheKey('findAll', [filter]);
      if (cache.has(key)) {
        const { value, expires } = cache.get(key);
        if (Date.now() < expires) return value;
      }

      const result = await repo.findAll(filter);
      cache.set(key, { value: result, expires: Date.now() + ttlMs });
      return result;
    },

    create: async (data) => {
      cache.clear(); // Invalidate on write
      return repo.create(data);
    },

    update: async (id, data) => {
      cache.clear();
      return repo.update(id, data);
    },

    delete: async (id) => {
      cache.clear();
      return repo.delete(id);
    },

    invalidate: () => cache.clear(),
  };
};

describe('Repository Tests', () => {
  let repo;

  beforeEach(() => {
    repo = createRepository();
  });

  it('should create entity', async () => {
    const entity = await repo.create({ name: 'Test' });

    expect(entity.id).toBeDefined();
    expect(entity.name).toBe('Test');
    expect(entity.createdAt).toBeDefined();
  });

  it('should find by id', async () => {
    const created = await repo.create({ name: 'Test' });
    const found = await repo.findById(created.id);

    expect(found).toEqual(created);
  });

  it('should find all with filter', async () => {
    await repo.create({ status: 'active' });
    await repo.create({ status: 'inactive' });
    await repo.create({ status: 'active' });

    const active = await repo.findAll({ status: 'active' });

    expect(active).toHaveLength(2);
  });

  it('should update entity', async () => {
    const created = await repo.create({ name: 'Old' });
    const updated = await repo.update(created.id, { name: 'New' });

    expect(updated.name).toBe('New');
  });

  it('should delete entity', async () => {
    const created = await repo.create({ name: 'Test' });
    await repo.delete(created.id);

    const found = await repo.findById(created.id);
    expect(found).toBeNull();
  });

  it('should count', async () => {
    await repo.create({ type: 'a' });
    await repo.create({ type: 'a' });
    await repo.create({ type: 'b' });

    expect(await repo.count({ type: 'a' })).toBe(2);
  });
});

describe('Query Repository Tests', () => {
  let repo;

  beforeEach(() => {
    repo = createQueryRepository([
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
      { id: 3, name: 'Charlie', age: 35 },
    ]);
  });

  it('should filter with where', () => {
    const result = repo.query().where('age', '>', 25).execute();

    expect(result).toHaveLength(2);
  });

  it('should order', () => {
    const result = repo.query().orderBy('age', 'desc').execute();

    expect(result[0].name).toBe('Charlie');
  });

  it('should limit and offset', () => {
    const result = repo.query().orderBy('age').limit(2).offset(1).execute();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
  });

  it('should select fields', () => {
    const result = repo.query().select('name').execute();

    expect(result[0]).toEqual({ name: 'Alice' });
  });

  it('should chain operations', () => {
    const result = repo
      .query()
      .where('age', '>=', 25)
      .orderBy('name')
      .limit(2)
      .select('name', 'age')
      .execute();

    expect(result).toHaveLength(2);
  });
});

describe('Cached Repository Tests', () => {
  let baseRepo;
  let cachedRepo;

  beforeEach(() => {
    baseRepo = createRepository();
    cachedRepo = createCachedRepository(baseRepo, 1000);
  });

  it('should cache findById', async () => {
    const entity = await cachedRepo.create({ name: 'Test' });
    const findByIdSpy = vi.spyOn(baseRepo, 'findById');

    await cachedRepo.findById(entity.id);
    await cachedRepo.findById(entity.id);

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
  });

  it('should invalidate on write', async () => {
    const entity = await cachedRepo.create({ name: 'Test' });
    await cachedRepo.findById(entity.id);

    await cachedRepo.update(entity.id, { name: 'Updated' });

    const findByIdSpy = vi.spyOn(baseRepo, 'findById');
    await cachedRepo.findById(entity.id);

    expect(findByIdSpy).toHaveBeenCalled();
  });
});
