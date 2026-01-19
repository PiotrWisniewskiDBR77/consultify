/**
 * Data Sharding Tests
 * Tests for data partitioning and sharding
 *
 * @module tests/sharding/data-sharding.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hash-based sharding
const createHashSharding = (shardCount) => {
  const hash = (key) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  };

  return {
    getShardId: (key) => {
      return hash(String(key)) % shardCount;
    },

    getShardIds: (keys) => {
      return keys.map((k) => this.getShardId(k));
    },

    groupByShardId: (items, keyFn) => {
      const groups = new Map();
      for (let i = 0; i < shardCount; i++) {
        groups.set(i, []);
      }

      for (const item of items) {
        const key = keyFn(item);
        const shardId = this.getShardId(key);
        groups.get(shardId).push(item);
      }

      return groups;
    },

    shardCount,
  };
};

// Range-based sharding
const createRangeSharding = (ranges) => {
  // ranges: [{ id: 0, min: 0, max: 1000 }, { id: 1, min: 1001, max: 2000 }, ...]

  return {
    getShardId: (value) => {
      for (const range of ranges) {
        if (value >= range.min && value <= range.max) {
          return range.id;
        }
      }
      return ranges[ranges.length - 1].id; // Default to last shard
    },

    addRange: (id, min, max) => {
      ranges.push({ id, min, max });
      ranges.sort((a, b) => a.min - b.min);
    },

    getRanges: () => [...ranges],

    splitRange: (shardId, splitPoint) => {
      const index = ranges.findIndex((r) => r.id === shardId);
      if (index === -1) return false;

      const original = ranges[index];
      if (splitPoint <= original.min || splitPoint >= original.max) {
        return false;
      }

      const newShard = {
        id: ranges.length,
        min: splitPoint + 1,
        max: original.max,
      };

      original.max = splitPoint;
      ranges.push(newShard);
      ranges.sort((a, b) => a.min - b.min);

      return newShard;
    },
  };
};

// Consistent hashing
const createConsistentHashing = (replicaCount = 100) => {
  const ring = new Map(); // position -> nodeId
  const nodes = new Set();

  const hash = (key) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 360;
  };

  const findNode = (position) => {
    const positions = [...ring.keys()].sort((a, b) => a - b);
    for (const pos of positions) {
      if (pos >= position) {
        return ring.get(pos);
      }
    }
    return ring.get(positions[0]); // Wrap around
  };

  return {
    addNode: (nodeId) => {
      nodes.add(nodeId);
      for (let i = 0; i < replicaCount; i++) {
        const position = hash(`${nodeId}:${i}`);
        ring.set(position, nodeId);
      }
    },

    removeNode: (nodeId) => {
      nodes.delete(nodeId);
      for (const [pos, id] of ring) {
        if (id === nodeId) {
          ring.delete(pos);
        }
      }
    },

    getNode: (key) => {
      if (ring.size === 0) return null;
      const position = hash(key);
      return findNode(position);
    },

    getNodes: () => [...nodes],

    getNodeCount: () => nodes.size,

    getRingSize: () => ring.size,
  };
};

// Shard manager
const createShardManager = (shardCount) => {
  const shards = new Map();
  const sharding = createHashSharding(shardCount);

  for (let i = 0; i < shardCount; i++) {
    shards.set(i, new Map());
  }

  return {
    set: (key, value) => {
      const shardId = sharding.getShardId(key);
      shards.get(shardId).set(key, value);
    },

    get: (key) => {
      const shardId = sharding.getShardId(key);
      return shards.get(shardId).get(key);
    },

    delete: (key) => {
      const shardId = sharding.getShardId(key);
      return shards.get(shardId).delete(key);
    },

    getShardStats: () => {
      const stats = [];
      for (const [id, shard] of shards) {
        stats.push({
          shardId: id,
          size: shard.size,
          keys: [...shard.keys()],
        });
      }
      return stats;
    },

    rebalance: () => {
      const allItems = [];
      for (const shard of shards.values()) {
        for (const [key, value] of shard) {
          allItems.push({ key, value });
        }
      }

      // Clear all shards
      for (const shard of shards.values()) {
        shard.clear();
      }

      // Redistribute
      for (const { key, value } of allItems) {
        this.set(key, value);
      }

      return allItems.length;
    },

    getShardId: (key) => sharding.getShardId(key),

    shardCount,
  };
};

describe('Hash Sharding Tests', () => {
  let sharding;

  beforeEach(() => {
    sharding = createHashSharding(4);
  });

  it('should return consistent shard', () => {
    const shard1 = sharding.getShardId('user:123');
    const shard2 = sharding.getShardId('user:123');

    expect(shard1).toBe(shard2);
  });

  it('should distribute across shards', () => {
    const shards = new Set();
    for (let i = 0; i < 100; i++) {
      shards.add(sharding.getShardId(`key:${i}`));
    }

    expect(shards.size).toBeGreaterThan(1);
  });

  it('should group by shard', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

    const groups = sharding.groupByShardId(items, (item) => item.id);

    let total = 0;
    for (const [, group] of groups) {
      total += group.length;
    }
    expect(total).toBe(4);
  });
});

describe('Range Sharding Tests', () => {
  let sharding;

  beforeEach(() => {
    sharding = createRangeSharding([
      { id: 0, min: 0, max: 100 },
      { id: 1, min: 101, max: 200 },
      { id: 2, min: 201, max: 300 },
    ]);
  });

  it('should get correct shard for range', () => {
    expect(sharding.getShardId(50)).toBe(0);
    expect(sharding.getShardId(150)).toBe(1);
    expect(sharding.getShardId(250)).toBe(2);
  });

  it('should split range', () => {
    const newShard = sharding.splitRange(0, 50);

    expect(newShard.min).toBe(51);
    expect(newShard.max).toBe(100);
    expect(sharding.getShardId(25)).toBe(0);
    expect(sharding.getShardId(75)).toBe(newShard.id);
  });
});

describe('Consistent Hashing Tests', () => {
  let ch;

  beforeEach(() => {
    ch = createConsistentHashing(10);
    ch.addNode('node-1');
    ch.addNode('node-2');
    ch.addNode('node-3');
  });

  it('should return consistent node', () => {
    const node1 = ch.getNode('key:123');
    const node2 = ch.getNode('key:123');

    expect(node1).toBe(node2);
  });

  it('should distribute keys', () => {
    const nodes = new Set();
    for (let i = 0; i < 100; i++) {
      nodes.add(ch.getNode(`key:${i}`));
    }

    expect(nodes.size).toBeGreaterThan(1);
  });

  it('should handle node removal', () => {
    const nodeBefore = ch.getNode('test-key');
    ch.removeNode(nodeBefore);

    const nodeAfter = ch.getNode('test-key');

    expect(nodeAfter).not.toBe(nodeBefore);
    expect(ch.getNodes()).not.toContain(nodeBefore);
  });

  it('should minimize redistribution on node add', () => {
    const keyToNode = new Map();
    for (let i = 0; i < 100; i++) {
      keyToNode.set(`key:${i}`, ch.getNode(`key:${i}`));
    }

    ch.addNode('node-4');

    let changed = 0;
    for (const [key, oldNode] of keyToNode) {
      if (ch.getNode(key) !== oldNode) {
        changed++;
      }
    }

    // Should have minimal redistribution
    expect(changed).toBeLessThan(50);
  });
});

describe('Shard Manager Tests', () => {
  let manager;

  beforeEach(() => {
    manager = createShardManager(4);
  });

  it('should set and get', () => {
    manager.set('key1', 'value1');
    expect(manager.get('key1')).toBe('value1');
  });

  it('should delete', () => {
    manager.set('key1', 'value1');
    manager.delete('key1');
    expect(manager.get('key1')).toBeUndefined();
  });

  it('should distribute across shards', () => {
    for (let i = 0; i < 100; i++) {
      manager.set(`key:${i}`, i);
    }

    const stats = manager.getShardStats();
    const nonEmpty = stats.filter((s) => s.size > 0);

    expect(nonEmpty.length).toBeGreaterThan(1);
  });

  it('should rebalance', () => {
    for (let i = 0; i < 50; i++) {
      manager.set(`key:${i}`, i);
    }

    const count = manager.rebalance();
    expect(count).toBe(50);
  });
});
