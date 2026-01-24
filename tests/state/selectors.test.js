/**
 * State Selectors and Derived State Tests
 * Tests for memoized selectors and computed state
 *
 * @module tests/state/selectors.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Basic memoized selector
const createSelector = (inputSelectors, resultFn) => {
  let lastInputs = null;
  let lastResult = null;
  let computeCount = 0;

  const selector = (state) => {
    const inputs = inputSelectors.map((sel) => sel(state));

    // Check if inputs changed
    const inputsChanged = lastInputs === null || inputs.some((input, i) => input !== lastInputs[i]);

    if (inputsChanged) {
      lastResult = resultFn(...inputs);
      lastInputs = inputs;
      computeCount++;
    }

    return lastResult;
  };

  selector.getComputeCount = () => computeCount;
  selector.clearCache = () => {
    lastInputs = null;
    lastResult = null;
  };

  return selector;
};

// Parameterized selector factory
const createParameterizedSelector = (inputSelectors, resultFn) => {
  const cache = new Map();
  const maxCacheSize = 100;

  return (state, ...params) => {
    const cacheKey = JSON.stringify(params);

    if (!cache.has(cacheKey)) {
      const selector = createSelector(inputSelectors, resultFn);

      // LRU: remove oldest if at capacity
      if (cache.size >= maxCacheSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(cacheKey, selector);
    }

    return cache.get(cacheKey)(state);
  };
};

// Selector with custom equality
const createSelectorWithEquality = (inputSelectors, resultFn, equalityFn) => {
  let lastInputs = null;
  let lastResult = null;

  return (state) => {
    const inputs = inputSelectors.map((sel) => sel(state));

    const inputsChanged = lastInputs === null || !equalityFn(inputs, lastInputs);

    if (inputsChanged) {
      lastResult = resultFn(...inputs);
      lastInputs = inputs;
    }

    return lastResult;
  };
};

// Structured selector (returns object of selector results)
const createStructuredSelector = (selectorMap) => {
  const keys = Object.keys(selectorMap);

  return createSelector(
    keys.map((key) => selectorMap[key]),
    (...values) => {
      const result = {};
      keys.forEach((key, i) => {
        result[key] = values[i];
      });
      return result;
    }
  );
};

// Selector composition utilities
const createSelectorCreator = (memoize) => {
  return (inputSelectors, resultFn) => {
    const memoizedResultFn = memoize(resultFn);

    return (state) => {
      const inputs = inputSelectors.map((sel) => sel(state));
      return memoizedResultFn(...inputs);
    };
  };
};

describe('Basic Selector Tests', () => {
  const getUsers = (state) => state.users;
  const getFilter = (state) => state.filter;

  it('should compute derived state', () => {
    const getFilteredUsers = createSelector([getUsers, getFilter], (users, filter) =>
      users.filter((u) => u.active === filter.active)
    );

    const state = {
      users: [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
      ],
      filter: { active: true },
    };

    const result = getFilteredUsers(state);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice');
  });

  it('should memoize results', () => {
    const computeFn = vi.fn((users) => users.map((u) => u.id));

    const getUserIds = createSelector([getUsers], computeFn);

    const state = { users: [{ id: 1 }, { id: 2 }] };

    getUserIds(state);
    getUserIds(state);
    getUserIds(state);

    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should recompute when inputs change', () => {
    const getUserIds = createSelector([getUsers], (users) => users.map((u) => u.id));

    const state1 = { users: [{ id: 1 }] };
    const state2 = { users: [{ id: 1 }, { id: 2 }] };

    const result1 = getUserIds(state1);
    const result2 = getUserIds(state2);

    expect(result1.length).toBe(1);
    expect(result2.length).toBe(2);
  });

  it('should track compute count', () => {
    const getUserNames = createSelector([getUsers], (users) => users.map((u) => u.name));

    const state = { users: [{ name: 'Test' }] };

    getUserNames(state);
    expect(getUserNames.getComputeCount()).toBe(1);

    getUserNames(state);
    expect(getUserNames.getComputeCount()).toBe(1);

    getUserNames({ users: [{ name: 'Changed' }] });
    expect(getUserNames.getComputeCount()).toBe(2);
  });

  it('should clear cache', () => {
    const getUserNames = createSelector(
      [getUsers],
      vi.fn((users) => users.map((u) => u.name))
    );

    const state = { users: [{ name: 'Test' }] };

    getUserNames(state);
    getUserNames.clearCache();
    getUserNames(state);

    expect(getUserNames.getComputeCount()).toBe(2);
  });
});

describe('Parameterized Selector Tests', () => {
  it('should handle parameters', () => {
    const getItems = (state) => state.items;

    const getItemById = createParameterizedSelector([getItems], (items, id) =>
      items.find((item) => item.id === id)
    );

    const state = {
      items: [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ],
    };

    expect(getItemById(state, 1).name).toBe('First');
    expect(getItemById(state, 2).name).toBe('Second');
  });

  it('should cache per parameter', () => {
    const computeFn = vi.fn((items, id) => items.find((item) => item.id === id));
    const getItems = (state) => state.items;

    const getItemById = createParameterizedSelector([getItems], computeFn);

    const state = { items: [{ id: 1 }, { id: 2 }] };

    getItemById(state, 1);
    getItemById(state, 1);
    getItemById(state, 2);
    getItemById(state, 2);

    // Called twice: once for id=1, once for id=2
    expect(computeFn).toHaveBeenCalledTimes(2);
  });
});

describe('Structured Selector Tests', () => {
  it('should return object of selected values', () => {
    const getName = (state) => state.name;
    const getAge = (state) => state.age;
    const getEmail = (state) => state.email;

    const getProfile = createStructuredSelector({
      name: getName,
      age: getAge,
      email: getEmail,
    });

    const state = { name: 'John', age: 30, email: 'john@example.com' };
    const result = getProfile(state);

    expect(result.name).toBe('John');
    expect(result.age).toBe(30);
    expect(result.email).toBe('john@example.com');
  });
});

describe('Custom Equality Selector Tests', () => {
  it('should use custom equality check', () => {
    const getConfig = (state) => state.config;
    const computeFn = vi.fn((config) => ({ ...config, processed: true }));

    // Deep equality check
    const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    const getProcessedConfig = createSelectorWithEquality([getConfig], computeFn, deepEqual);

    const state1 = { config: { theme: 'dark' } };
    const state2 = { config: { theme: 'dark' } }; // New reference, same value

    getProcessedConfig(state1);
    getProcessedConfig(state2);

    // With deep equality, should only compute once
    expect(computeFn).toHaveBeenCalledTimes(1);
  });
});

describe('Selector Composition Tests', () => {
  it('should compose selectors', () => {
    const getUsers = (state) => state.users;
    const getActiveFilter = (state) => state.showActive;

    const getActiveUsers = createSelector([getUsers, getActiveFilter], (users, showActive) =>
      showActive ? users.filter((u) => u.active) : users
    );

    const getSortedActiveUsers = createSelector([getActiveUsers], (users) =>
      [...users].sort((a, b) => a.name.localeCompare(b.name))
    );

    const state = {
      users: [
        { name: 'Charlie', active: true },
        { name: 'Alice', active: true },
        { name: 'Bob', active: false },
      ],
      showActive: true,
    };

    const result = getSortedActiveUsers(state);

    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Charlie');
  });

  it('should efficiently chain selectors', () => {
    const step1Fn = vi.fn((items) => items.filter((i) => i.visible));
    const step2Fn = vi.fn((items) => items.map((i) => i.value));
    const step3Fn = vi.fn((values) => values.reduce((a, b) => a + b, 0));

    const getItems = (state) => state.items;

    const getVisibleItems = createSelector([getItems], step1Fn);
    const getValues = createSelector([getVisibleItems], step2Fn);
    const getTotal = createSelector([getValues], step3Fn);

    const state = {
      items: [
        { value: 10, visible: true },
        { value: 20, visible: false },
        { value: 30, visible: true },
      ],
    };

    const result = getTotal(state);
    expect(result).toBe(40);

    // Call again - should use cache
    getTotal(state);

    expect(step1Fn).toHaveBeenCalledTimes(1);
    expect(step2Fn).toHaveBeenCalledTimes(1);
    expect(step3Fn).toHaveBeenCalledTimes(1);
  });
});
