/**
 * State Synchronization Tests
 * Tests for state sync across tabs/windows
 *
 * @module tests/state/state-sync.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Cross-tab state sync
const createCrossTabSync = (key) => {
  let state = null;
  const listeners = [];
  let storageListener = null;

  const notifyListeners = (newState, source) => {
    listeners.forEach((fn) => fn(newState, source));
  };

  return {
    init: (initialState) => {
      state = initialState;

      // In real implementation, listen to storage events
      // window.addEventListener('storage', handler)
      storageListener = (event) => {
        if (event.key === key) {
          state = JSON.parse(event.newValue);
          notifyListeners(state, 'remote');
        }
      };
    },

    getState: () => state,

    setState: (newState) => {
      state = newState;

      // In real implementation, save to localStorage
      // localStorage.setItem(key, JSON.stringify(state))

      notifyListeners(state, 'local');
    },

    patchState: (patch) => {
      state = { ...state, ...patch };
      notifyListeners(state, 'local');
    },

    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },

    // Simulate receiving update from another tab
    _simulateRemoteUpdate: (newState) => {
      state = newState;
      notifyListeners(state, 'remote');
    },

    destroy: () => {
      listeners.length = 0;
      storageListener = null;
    },
  };
};

// Broadcast channel wrapper
const createBroadcastSync = (channelName) => {
  const listeners = new Map();
  let channel = null;
  const sentMessages = [];

  return {
    open: () => {
      // Mock BroadcastChannel
      channel = {
        name: channelName,
        postMessage: (data) => sentMessages.push(data),
        close: () => {},
        onmessage: null,
      };
    },

    close: () => {
      channel?.close();
      channel = null;
      listeners.clear();
    },

    send: (type, payload) => {
      if (!channel) throw new Error('Channel not open');

      const message = {
        id: crypto.randomUUID(),
        type,
        payload,
        timestamp: Date.now(),
        source: 'self',
      };

      channel.postMessage(message);
      return message.id;
    },

    on: (type, handler) => {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(handler);

      return () => {
        const handlers = listeners.get(type);
        const index = handlers?.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      };
    },

    // Simulate receiving message
    _simulateMessage: (type, payload) => {
      const handlers = listeners.get(type) || [];
      handlers.forEach((fn) => fn(payload, { type, timestamp: Date.now() }));
    },

    isOpen: () => channel !== null,

    getSentMessages: () => [...sentMessages],
  };
};

// Leader election for tabs
const createLeaderElection = (key) => {
  let isLeader = false;
  let leaderId = null;
  const tabId = crypto.randomUUID();
  const listeners = { elected: [], demoted: [] };

  const heartbeatInterval = 1000;
  let heartbeatTimer = null;

  return {
    start: () => {
      // Try to become leader
      // In real implementation, use localStorage with timestamp
      leaderId = tabId;
      isLeader = true;

      listeners.elected.forEach((fn) => fn());

      heartbeatTimer = setInterval(() => {
        // Update heartbeat timestamp
      }, heartbeatInterval);
    },

    stop: () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      if (isLeader) {
        isLeader = false;
        listeners.demoted.forEach((fn) => fn());
      }
    },

    isLeader: () => isLeader,

    getLeaderId: () => leaderId,

    getTabId: () => tabId,

    onElected: (handler) => {
      listeners.elected.push(handler);
      return () => {
        const index = listeners.elected.indexOf(handler);
        if (index !== -1) listeners.elected.splice(index, 1);
      };
    },

    onDemoted: (handler) => {
      listeners.demoted.push(handler);
      return () => {
        const index = listeners.demoted.indexOf(handler);
        if (index !== -1) listeners.demoted.splice(index, 1);
      };
    },

    // Simulate another tab taking leadership
    _simulateLostLeadership: () => {
      if (isLeader) {
        isLeader = false;
        leaderId = 'other-tab';
        listeners.demoted.forEach((fn) => fn());
      }
    },
  };
};

// Conflict resolution
const createConflictResolver = (strategy = 'last-write-wins') => {
  const strategies = {
    'last-write-wins': (local, remote) => {
      if (remote.timestamp > local.timestamp) {
        return { resolved: remote.state, source: 'remote' };
      }
      return { resolved: local.state, source: 'local' };
    },

    'first-write-wins': (local, remote) => {
      if (local.timestamp < remote.timestamp) {
        return { resolved: local.state, source: 'local' };
      }
      return { resolved: remote.state, source: 'remote' };
    },

    merge: (local, remote) => {
      const merged = { ...remote.state, ...local.state };
      return { resolved: merged, source: 'merged' };
    },

    manual: (local, remote) => {
      return {
        resolved: null,
        source: 'conflict',
        local: local.state,
        remote: remote.state,
      };
    },
  };

  return {
    resolve: (local, remote) => {
      const resolverFn = strategies[strategy];
      if (!resolverFn) {
        throw new Error(`Unknown strategy: ${strategy}`);
      }
      return resolverFn(local, remote);
    },

    setStrategy: (newStrategy) => {
      strategy = newStrategy;
    },

    getStrategy: () => strategy,
  };
};

describe('Cross-Tab Sync Tests', () => {
  let sync;

  beforeEach(() => {
    sync = createCrossTabSync('app-state');
    sync.init({ count: 0 });
  });

  afterEach(() => {
    sync.destroy();
  });

  it('should init with state', () => {
    expect(sync.getState().count).toBe(0);
  });

  it('should set state', () => {
    sync.setState({ count: 5 });

    expect(sync.getState().count).toBe(5);
  });

  it('should patch state', () => {
    sync.patchState({ count: 10 });

    expect(sync.getState().count).toBe(10);
  });

  it('should notify on local change', () => {
    const handler = vi.fn();
    sync.subscribe(handler);

    sync.setState({ count: 1 });

    expect(handler).toHaveBeenCalledWith({ count: 1 }, 'local');
  });

  it('should notify on remote change', () => {
    const handler = vi.fn();
    sync.subscribe(handler);

    sync._simulateRemoteUpdate({ count: 100 });

    expect(handler).toHaveBeenCalledWith({ count: 100 }, 'remote');
  });

  it('should unsubscribe', () => {
    const handler = vi.fn();
    const unsubscribe = sync.subscribe(handler);

    unsubscribe();
    sync.setState({ count: 1 });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Broadcast Sync Tests', () => {
  let broadcast;

  beforeEach(() => {
    broadcast = createBroadcastSync('app-channel');
    broadcast.open();
  });

  afterEach(() => {
    broadcast.close();
  });

  it('should open channel', () => {
    expect(broadcast.isOpen()).toBe(true);
  });

  it('should send message', () => {
    const messageId = broadcast.send('state-update', { value: 1 });

    expect(messageId).toBeTruthy();
    expect(broadcast.getSentMessages().length).toBe(1);
  });

  it('should receive messages', () => {
    const handler = vi.fn();
    broadcast.on('state-update', handler);

    broadcast._simulateMessage('state-update', { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 }, expect.any(Object));
  });

  it('should unsubscribe from messages', () => {
    const handler = vi.fn();
    const unsubscribe = broadcast.on('test', handler);

    unsubscribe();
    broadcast._simulateMessage('test', {});

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Leader Election Tests', () => {
  let leader;

  beforeEach(() => {
    leader = createLeaderElection('app-leader');
  });

  afterEach(() => {
    leader.stop();
  });

  it('should become leader', () => {
    leader.start();

    expect(leader.isLeader()).toBe(true);
  });

  it('should have tab ID', () => {
    expect(leader.getTabId()).toBeTruthy();
  });

  it('should notify on election', () => {
    const handler = vi.fn();
    leader.onElected(handler);

    leader.start();

    expect(handler).toHaveBeenCalled();
  });

  it('should notify on demotion', () => {
    const handler = vi.fn();
    leader.onDemoted(handler);

    leader.start();
    leader._simulateLostLeadership();

    expect(handler).toHaveBeenCalled();
  });

  it('should stop', () => {
    leader.start();
    leader.stop();

    expect(leader.isLeader()).toBe(false);
  });
});

describe('Conflict Resolver Tests', () => {
  it('should resolve with last-write-wins', () => {
    const resolver = createConflictResolver('last-write-wins');

    const result = resolver.resolve(
      { state: { a: 1 }, timestamp: 1000 },
      { state: { a: 2 }, timestamp: 2000 }
    );

    expect(result.source).toBe('remote');
    expect(result.resolved.a).toBe(2);
  });

  it('should resolve with first-write-wins', () => {
    const resolver = createConflictResolver('first-write-wins');

    const result = resolver.resolve(
      { state: { a: 1 }, timestamp: 1000 },
      { state: { a: 2 }, timestamp: 2000 }
    );

    expect(result.source).toBe('local');
    expect(result.resolved.a).toBe(1);
  });

  it('should merge states', () => {
    const resolver = createConflictResolver('merge');

    const result = resolver.resolve(
      { state: { a: 1, b: 2 }, timestamp: 1000 },
      { state: { a: 100, c: 3 }, timestamp: 2000 }
    );

    expect(result.source).toBe('merged');
    expect(result.resolved.a).toBe(1); // Local wins in merge
    expect(result.resolved.c).toBe(3);
  });

  it('should return conflict for manual resolution', () => {
    const resolver = createConflictResolver('manual');

    const result = resolver.resolve(
      { state: { a: 1 }, timestamp: 1000 },
      { state: { a: 2 }, timestamp: 2000 }
    );

    expect(result.source).toBe('conflict');
    expect(result.local.a).toBe(1);
    expect(result.remote.a).toBe(2);
  });
});
