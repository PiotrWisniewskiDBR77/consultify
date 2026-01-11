/**
 * CRDT (Conflict-free Replicated Data Types) Tests
 * Tests for real-time collaboration data structures
 *
 * @module tests/collaboration/crdt.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// G-Counter (Grow-only Counter)
const createGCounter = (nodeId) => {
  const counts = new Map();
  counts.set(nodeId, 0);

  return {
    nodeId,

    increment: (amount = 1) => {
      const current = counts.get(nodeId) || 0;
      counts.set(nodeId, current + amount);
    },

    value: () => {
      let total = 0;
      for (const count of counts.values()) {
        total += count;
      }
      return total;
    },

    merge: (other) => {
      for (const [node, count] of other.getState()) {
        const current = counts.get(node) || 0;
        counts.set(node, Math.max(current, count));
      }
    },

    getState: () => new Map(counts),
  };
};

// PN-Counter (Positive-Negative Counter)
const createPNCounter = (nodeId) => {
  const positive = createGCounter(nodeId);
  const negative = createGCounter(nodeId);

  return {
    nodeId,

    increment: (amount = 1) => {
      positive.increment(amount);
    },

    decrement: (amount = 1) => {
      negative.increment(amount);
    },

    value: () => positive.value() - negative.value(),

    merge: (other) => {
      positive.merge(other.getPositive());
      negative.merge(other.getNegative());
    },

    getPositive: () => positive,
    getNegative: () => negative,
  };
};

// LWW-Register (Last-Writer-Wins Register)
const createLWWRegister = (nodeId) => {
  let value = null;
  let timestamp = 0;
  let lastNodeId = nodeId;

  return {
    nodeId,

    set: (newValue, ts = Date.now()) => {
      if (ts > timestamp || (ts === timestamp && nodeId > lastNodeId)) {
        value = newValue;
        timestamp = ts;
        lastNodeId = nodeId;
      }
    },

    get: () => value,

    getTimestamp: () => timestamp,

    merge: (other) => {
      const otherTs = other.getTimestamp();
      const otherValue = other.get();
      const otherNodeId = other.nodeId;

      if (otherTs > timestamp || (otherTs === timestamp && otherNodeId > lastNodeId)) {
        value = otherValue;
        timestamp = otherTs;
        lastNodeId = otherNodeId;
      }
    },

    getState: () => ({ value, timestamp, nodeId: lastNodeId }),
  };
};

// G-Set (Grow-only Set)
const createGSet = () => {
  const elements = new Set();

  return {
    add: (element) => {
      elements.add(element);
    },

    has: (element) => elements.has(element),

    values: () => [...elements],

    size: () => elements.size,

    merge: (other) => {
      for (const element of other.values()) {
        elements.add(element);
      }
    },
  };
};

// 2P-Set (Two-Phase Set - add and remove)
const createTwoPSet = () => {
  const added = createGSet();
  const removed = createGSet();

  return {
    add: (element) => {
      added.add(element);
    },

    remove: (element) => {
      if (added.has(element)) {
        removed.add(element);
      }
    },

    has: (element) => added.has(element) && !removed.has(element),

    values: () => added.values().filter((e) => !removed.has(e)),

    merge: (other) => {
      added.merge(other.getAdded());
      removed.merge(other.getRemoved());
    },

    getAdded: () => added,
    getRemoved: () => removed,
  };
};

// LWW-Element-Set
const createLWWElementSet = () => {
  const addSet = new Map(); // element -> timestamp
  const removeSet = new Map();

  return {
    add: (element, ts = Date.now()) => {
      const currentTs = addSet.get(element) || 0;
      if (ts >= currentTs) {
        addSet.set(element, ts);
      }
    },

    remove: (element, ts = Date.now()) => {
      const currentTs = removeSet.get(element) || 0;
      if (ts >= currentTs) {
        removeSet.set(element, ts);
      }
    },

    has: (element) => {
      const addTs = addSet.get(element);
      const removeTs = removeSet.get(element);

      if (addTs === undefined) return false;
      if (removeTs === undefined) return true;

      return addTs > removeTs;
    },

    values: () => {
      const result = [];
      for (const [element, addTs] of addSet) {
        const removeTs = removeSet.get(element) || 0;
        if (addTs > removeTs) {
          result.push(element);
        }
      }
      return result;
    },

    merge: (other) => {
      const otherState = other.getState();

      for (const [element, ts] of otherState.addSet) {
        const currentTs = addSet.get(element) || 0;
        if (ts > currentTs) {
          addSet.set(element, ts);
        }
      }

      for (const [element, ts] of otherState.removeSet) {
        const currentTs = removeSet.get(element) || 0;
        if (ts > currentTs) {
          removeSet.set(element, ts);
        }
      }
    },

    getState: () => ({
      addSet: new Map(addSet),
      removeSet: new Map(removeSet),
    }),
  };
};

// Vector Clock
const createVectorClock = (nodeId) => {
  const clock = new Map();
  clock.set(nodeId, 0);

  return {
    nodeId,

    increment: () => {
      const current = clock.get(nodeId) || 0;
      clock.set(nodeId, current + 1);
    },

    get: (node) => clock.get(node) || 0,

    merge: (other) => {
      for (const [node, time] of other.getClock()) {
        const current = clock.get(node) || 0;
        clock.set(node, Math.max(current, time));
      }
    },

    happensBefore: (other) => {
      let atLeastOneLess = false;

      for (const [node, time] of clock) {
        const otherTime = other.get(node);
        if (time > otherTime) return false;
        if (time < otherTime) atLeastOneLess = true;
      }

      for (const [node] of other.getClock()) {
        if (!clock.has(node)) {
          if (other.get(node) > 0) atLeastOneLess = true;
        }
      }

      return atLeastOneLess;
    },

    concurrent: (other) => {
      return !this.happensBefore(other) && !other.happensBefore(this);
    },

    getClock: () => new Map(clock),

    toString: () => {
      return [...clock.entries()].map(([k, v]) => `${k}:${v}`).join(',');
    },
  };
};

describe('G-Counter Tests', () => {
  it('should increment counter', () => {
    const counter = createGCounter('node1');

    counter.increment();
    counter.increment(5);

    expect(counter.value()).toBe(6);
  });

  it('should merge counters', () => {
    const c1 = createGCounter('node1');
    const c2 = createGCounter('node2');

    c1.increment(3);
    c2.increment(5);

    c1.merge(c2);

    expect(c1.value()).toBe(8);
  });

  it('should handle concurrent increments', () => {
    const c1 = createGCounter('node1');
    const c2 = createGCounter('node2');

    c1.increment(10);
    c2.increment(20);

    c1.merge(c2);
    c2.merge(c1);

    expect(c1.value()).toBe(c2.value());
    expect(c1.value()).toBe(30);
  });
});

describe('PN-Counter Tests', () => {
  it('should increment and decrement', () => {
    const counter = createPNCounter('node1');

    counter.increment(10);
    counter.decrement(3);

    expect(counter.value()).toBe(7);
  });

  it('should merge with negative values', () => {
    const c1 = createPNCounter('node1');
    const c2 = createPNCounter('node2');

    c1.increment(5);
    c2.decrement(3);

    c1.merge(c2);

    expect(c1.value()).toBe(2);
  });
});

describe('LWW-Register Tests', () => {
  it('should set and get value', () => {
    const reg = createLWWRegister('node1');

    reg.set('hello', 1000);

    expect(reg.get()).toBe('hello');
  });

  it('should use latest timestamp', () => {
    const reg = createLWWRegister('node1');

    reg.set('old', 1000);
    reg.set('new', 2000);
    reg.set('ignored', 500);

    expect(reg.get()).toBe('new');
  });

  it('should merge with later timestamp winning', () => {
    const r1 = createLWWRegister('node1');
    const r2 = createLWWRegister('node2');

    r1.set('value1', 1000);
    r2.set('value2', 2000);

    r1.merge(r2);

    expect(r1.get()).toBe('value2');
  });
});

describe('G-Set Tests', () => {
  it('should add elements', () => {
    const set = createGSet();

    set.add('a');
    set.add('b');

    expect(set.has('a')).toBe(true);
    expect(set.has('c')).toBe(false);
    expect(set.size()).toBe(2);
  });

  it('should merge sets', () => {
    const s1 = createGSet();
    const s2 = createGSet();

    s1.add('a');
    s2.add('b');

    s1.merge(s2);

    expect(s1.values()).toContain('a');
    expect(s1.values()).toContain('b');
  });
});

describe('2P-Set Tests', () => {
  it('should add and remove', () => {
    const set = createTwoPSet();

    set.add('item');
    expect(set.has('item')).toBe(true);

    set.remove('item');
    expect(set.has('item')).toBe(false);
  });

  it('should not allow re-add after remove', () => {
    const set = createTwoPSet();

    set.add('item');
    set.remove('item');
    set.add('item'); // This won't work in 2P-Set

    // The item is in both added and removed, so it's considered removed
    expect(set.has('item')).toBe(false);
  });

  it('should merge sets', () => {
    const s1 = createTwoPSet();
    const s2 = createTwoPSet();

    s1.add('a');
    s1.add('b');
    s2.add('a');
    s2.remove('a');

    s1.merge(s2);

    expect(s1.has('a')).toBe(false);
    expect(s1.has('b')).toBe(true);
  });
});

describe('LWW-Element-Set Tests', () => {
  it('should add and remove with timestamps', () => {
    const set = createLWWElementSet();

    set.add('item', 1000);
    expect(set.has('item')).toBe(true);

    set.remove('item', 2000);
    expect(set.has('item')).toBe(false);
  });

  it('should handle add-remove-add correctly', () => {
    const set = createLWWElementSet();

    set.add('item', 1000);
    set.remove('item', 2000);
    set.add('item', 3000);

    expect(set.has('item')).toBe(true);
  });

  it('should merge correctly', () => {
    const s1 = createLWWElementSet();
    const s2 = createLWWElementSet();

    s1.add('item', 1000);
    s2.remove('item', 2000);

    s1.merge(s2);

    expect(s1.has('item')).toBe(false);
  });
});

describe('Vector Clock Tests', () => {
  it('should increment', () => {
    const vc = createVectorClock('node1');

    vc.increment();
    vc.increment();

    expect(vc.get('node1')).toBe(2);
  });

  it('should merge clocks', () => {
    const vc1 = createVectorClock('node1');
    const vc2 = createVectorClock('node2');

    vc1.increment();
    vc2.increment();
    vc2.increment();

    vc1.merge(vc2);

    expect(vc1.get('node1')).toBe(1);
    expect(vc1.get('node2')).toBe(2);
  });

  it('should detect happens-before', () => {
    const vc1 = createVectorClock('node1');
    const vc2 = createVectorClock('node1');

    vc1.increment();
    vc2.increment();
    vc2.increment();

    expect(vc1.happensBefore(vc2)).toBe(true);
    expect(vc2.happensBefore(vc1)).toBe(false);
  });
});
