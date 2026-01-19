/**
 * Finite State Machine Tests
 * Tests for state machine patterns
 *
 * @module tests/fsm/state-machine.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Finite state machine
const createStateMachine = (config) => {
  let currentState = config.initial;
  const listeners = [];
  const context = config.context || {};

  return {
    getState: () => currentState,

    getContext: () => ({ ...context }),

    can: (event) => {
      const stateConfig = config.states[currentState];
      return stateConfig?.on?.[event] !== undefined;
    },

    send: (event, payload = {}) => {
      const stateConfig = config.states[currentState];
      const transition = stateConfig?.on?.[event];

      if (!transition) {
        return { changed: false, state: currentState };
      }

      const target = typeof transition === 'string' ? transition : transition.target;
      const action = typeof transition === 'object' ? transition.action : null;
      const guard = typeof transition === 'object' ? transition.guard : null;

      // Check guard
      if (guard && !guard(context, payload)) {
        return { changed: false, state: currentState };
      }

      const previousState = currentState;
      currentState = target;

      // Run exit action
      if (stateConfig.onExit) {
        stateConfig.onExit(context, payload);
      }

      // Run transition action
      if (action) {
        action(context, payload);
      }

      // Run entry action
      const newStateConfig = config.states[currentState];
      if (newStateConfig?.onEntry) {
        newStateConfig.onEntry(context, payload);
      }

      // Notify listeners
      for (const listener of listeners) {
        listener({ from: previousState, to: currentState, event, payload });
      }

      return { changed: true, state: currentState };
    },

    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    matches: (state) => currentState === state,

    reset: () => {
      currentState = config.initial;
    },
  };
};

// Hierarchical state machine
const createHierarchicalMachine = (config) => {
  let currentPath = [config.initial];

  const getStateConfig = (path) => {
    let current = config.states;
    for (const state of path) {
      current = current[state];
      if (current?.states) {
        current = current.states;
      }
    }
    return current;
  };

  return {
    getState: () => currentPath.join('.'),

    getCurrentPath: () => [...currentPath],

    send: (event) => {
      // Check from deepest to root
      for (let i = currentPath.length - 1; i >= 0; i--) {
        const pathToCheck = currentPath.slice(0, i + 1);
        let stateConfig = config.states;

        for (const state of pathToCheck) {
          stateConfig = stateConfig[state];
        }

        if (stateConfig?.on?.[event]) {
          const target = stateConfig.on[event];
          const targetPath = target.split('.');
          currentPath = targetPath;
          return { changed: true, state: this.getState() };
        }
      }

      return { changed: false, state: this.getState() };
    },

    isIn: (state) => {
      const checkPath = state.split('.');
      if (checkPath.length > currentPath.length) return false;

      for (let i = 0; i < checkPath.length; i++) {
        if (checkPath[i] !== currentPath[i]) return false;
      }
      return true;
    },
  };
};

// Parallel state machine
const createParallelMachine = (regions) => {
  const machines = {};

  for (const [name, config] of Object.entries(regions)) {
    machines[name] = createStateMachine(config);
  }

  return {
    getState: () => {
      const state = {};
      for (const [name, machine] of Object.entries(machines)) {
        state[name] = machine.getState();
      }
      return state;
    },

    send: (event, payload) => {
      const results = {};
      for (const [name, machine] of Object.entries(machines)) {
        results[name] = machine.send(event, payload);
      }
      return results;
    },

    sendTo: (region, event, payload) => {
      return machines[region]?.send(event, payload);
    },

    getRegion: (name) => machines[name],
  };
};

describe('State Machine Tests', () => {
  let machine;

  beforeEach(() => {
    machine = createStateMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            START: 'running',
            SKIP: { target: 'completed', guard: (ctx) => ctx.count > 0 },
          },
        },
        running: {
          onEntry: (ctx) => {
            ctx.count++;
          },
          on: {
            PAUSE: 'paused',
            COMPLETE: 'completed',
          },
        },
        paused: {
          on: {
            RESUME: 'running',
            STOP: 'idle',
          },
        },
        completed: {
          on: {
            RESET: 'idle',
          },
        },
      },
    });
  });

  it('should start in initial state', () => {
    expect(machine.getState()).toBe('idle');
  });

  it('should transition', () => {
    const result = machine.send('START');

    expect(result.changed).toBe(true);
    expect(machine.getState()).toBe('running');
  });

  it('should not transition on invalid event', () => {
    const result = machine.send('INVALID');

    expect(result.changed).toBe(false);
    expect(machine.getState()).toBe('idle');
  });

  it('should check can transition', () => {
    expect(machine.can('START')).toBe(true);
    expect(machine.can('PAUSE')).toBe(false);
  });

  it('should run entry actions', () => {
    machine.send('START');

    expect(machine.getContext().count).toBe(1);
  });

  it('should respect guards', () => {
    const result = machine.send('SKIP');

    expect(result.changed).toBe(false); // Guard fails (count = 0)
  });

  it('should notify subscribers', () => {
    const handler = vi.fn();
    machine.subscribe(handler);

    machine.send('START');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'idle', to: 'running', event: 'START' })
    );
  });

  it('should match state', () => {
    expect(machine.matches('idle')).toBe(true);
    machine.send('START');
    expect(machine.matches('running')).toBe(true);
  });
});

describe('Hierarchical Machine Tests', () => {
  let machine;

  beforeEach(() => {
    machine = createHierarchicalMachine({
      initial: 'active',
      states: {
        active: {
          initial: 'idle',
          on: { DEACTIVATE: 'inactive' },
          states: {
            idle: { on: { START: 'active.running' } },
            running: { on: { STOP: 'active.idle' } },
          },
        },
        inactive: {
          on: { ACTIVATE: 'active' },
        },
      },
    });
  });

  it('should track hierarchical state', () => {
    expect(machine.getState()).toBe('active');
  });

  it('should check isIn for parent states', () => {
    expect(machine.isIn('active')).toBe(true);
  });
});

describe('Parallel Machine Tests', () => {
  let machine;

  beforeEach(() => {
    machine = createParallelMachine({
      player: {
        initial: 'stopped',
        states: {
          stopped: { on: { PLAY: 'playing' } },
          playing: { on: { STOP: 'stopped' } },
        },
      },
      volume: {
        initial: 'normal',
        states: {
          normal: { on: { MUTE: 'muted' } },
          muted: { on: { UNMUTE: 'normal' } },
        },
      },
    });
  });

  it('should track parallel states', () => {
    expect(machine.getState()).toEqual({ player: 'stopped', volume: 'normal' });
  });

  it('should send to all regions', () => {
    machine.send('PLAY');

    expect(machine.getState().player).toBe('playing');
  });

  it('should send to specific region', () => {
    machine.sendTo('volume', 'MUTE');

    expect(machine.getState().volume).toBe('muted');
    expect(machine.getState().player).toBe('stopped');
  });
});
