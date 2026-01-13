/**
 * State Middleware Tests
 * Tests for state management middleware patterns
 *
 * @module tests/state/middleware.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple store implementation for testing middleware
const createStore = (reducer, initialState, middlewares = []) => {
  let state = initialState;
  const listeners = [];

  const getState = () => state;

  const dispatch = (action) => {
    // Build middleware chain
    const chain = middlewares.map((mw) => mw({ getState, dispatch: baseDispatch }));

    const baseDispatch = (action) => {
      state = reducer(state, action);
      listeners.forEach((listener) => listener(state));
      return action;
    };

    // Compose middleware
    const composedDispatch = chain.reduceRight(
      (next, middleware) => middleware(next),
      baseDispatch
    );

    return composedDispatch(action);
  };

  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  };

  return { getState, dispatch, subscribe };
};

// Logger middleware
const createLoggerMiddleware = (logger = console) => {
  const logs = [];

  const middleware =
    ({ getState }) =>
    (next) =>
    (action) => {
      const prevState = getState();
      const result = next(action);
      const nextState = getState();

      const log = {
        action,
        prevState,
        nextState,
        timestamp: Date.now(),
      };

      logs.push(log);
      logger.log?.('Action:', action.type);

      return result;
    };

  middleware.getLogs = () => logs;
  middleware.clear = () => {
    logs.length = 0;
  };

  return middleware;
};

// Thunk middleware (async actions)
const thunkMiddleware =
  ({ dispatch, getState }) =>
  (next) =>
  (action) => {
    if (typeof action === 'function') {
      return action(dispatch, getState);
    }
    return next(action);
  };

// Promise middleware
const promiseMiddleware =
  ({ dispatch }) =>
  (next) =>
  async (action) => {
    if (action.payload instanceof Promise) {
      try {
        const result = await action.payload;
        return next({ ...action, payload: result });
      } catch (error) {
        return next({ ...action, payload: error, error: true });
      }
    }
    return next(action);
  };

// Debounce middleware
const createDebounceMiddleware = (debounceMs = 100) => {
  const timers = new Map();

  return () => (next) => (action) => {
    if (action.meta?.debounce) {
      const key = action.meta.debounceKey || action.type;

      if (timers.has(key)) {
        clearTimeout(timers.get(key));
      }

      return new Promise((resolve) => {
        timers.set(
          key,
          setTimeout(() => {
            timers.delete(key);
            resolve(next(action));
          }, action.meta.debounce || debounceMs)
        );
      });
    }
    return next(action);
  };
};

// Validation middleware
const createValidationMiddleware = (validators = {}) => {
  return () => (next) => (action) => {
    const validator = validators[action.type];

    if (validator) {
      const validationResult = validator(action.payload);

      if (!validationResult.valid) {
        return {
          type: `${action.type}_VALIDATION_ERROR`,
          payload: validationResult.errors,
          originalAction: action,
        };
      }
    }

    return next(action);
  };
};

// Analytics middleware
const createAnalyticsMiddleware = (tracker) => {
  return () => (next) => (action) => {
    if (action.meta?.track) {
      tracker.track(action.meta.track, {
        action: action.type,
        ...action.meta.trackData,
      });
    }
    return next(action);
  };
};

// Error handling middleware
const createErrorMiddleware = (errorHandler) => {
  return ({ dispatch }) =>
    (next) =>
    (action) => {
      try {
        return next(action);
      } catch (error) {
        errorHandler(error, action, dispatch);
        return { type: 'ERROR', payload: error, originalAction: action };
      }
    };
};

describe('Logger Middleware Tests', () => {
  it('should log actions', () => {
    const loggerMw = createLoggerMiddleware({ log: vi.fn() });
    const reducer = (state, action) => ({ ...state, count: state.count + 1 });
    const store = createStore(reducer, { count: 0 }, [loggerMw]);

    store.dispatch({ type: 'INCREMENT' });

    const logs = loggerMw.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].action.type).toBe('INCREMENT');
  });

  it('should capture state changes', () => {
    const loggerMw = createLoggerMiddleware({ log: vi.fn() });
    const reducer = (state, action) => {
      if (action.type === 'SET') return { value: action.payload };
      return state;
    };
    const store = createStore(reducer, { value: 0 }, [loggerMw]);

    store.dispatch({ type: 'SET', payload: 42 });

    const logs = loggerMw.getLogs();
    expect(logs[0].prevState.value).toBe(0);
    expect(logs[0].nextState.value).toBe(42);
  });
});

describe('Thunk Middleware Tests', () => {
  it('should handle function actions', async () => {
    const reducer = (state, action) => {
      if (action.type === 'SET_DATA') return { data: action.payload };
      return state;
    };
    const store = createStore(reducer, { data: null }, [thunkMiddleware]);

    const asyncAction = (dispatch) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          dispatch({ type: 'SET_DATA', payload: 'loaded' });
          resolve();
        }, 10);
      });
    };

    await store.dispatch(asyncAction);

    expect(store.getState().data).toBe('loaded');
  });

  it('should provide getState to thunks', () => {
    const reducer = (state, action) => {
      if (action.type === 'ADD') return { count: state.count + action.payload };
      return state;
    };
    const store = createStore(reducer, { count: 5 }, [thunkMiddleware]);

    const conditionalAction = (dispatch, getState) => {
      if (getState().count < 10) {
        dispatch({ type: 'ADD', payload: 5 });
      }
    };

    store.dispatch(conditionalAction);

    expect(store.getState().count).toBe(10);
  });
});

describe('Promise Middleware Tests', () => {
  it('should resolve promise payload', async () => {
    const reducer = (state, action) => {
      if (action.type === 'LOAD') return { data: action.payload };
      return state;
    };
    const store = createStore(reducer, { data: null }, [promiseMiddleware]);

    await store.dispatch({
      type: 'LOAD',
      payload: Promise.resolve('async data'),
    });

    expect(store.getState().data).toBe('async data');
  });

  it('should handle promise rejection', async () => {
    const reducer = (state, action) => {
      if (action.type === 'LOAD') {
        return {
          data: action.error ? null : action.payload,
          error: action.error ? action.payload : null,
        };
      }
      return state;
    };
    const store = createStore(reducer, { data: null, error: null }, [promiseMiddleware]);

    const error = new Error('Failed');
    await store.dispatch({
      type: 'LOAD',
      payload: Promise.reject(error),
    });

    expect(store.getState().error).toBe(error);
  });
});

describe('Debounce Middleware Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce actions', async () => {
    const debounceMw = createDebounceMiddleware(100);
    const reducer = vi.fn((state, action) => {
      if (action.type === 'SEARCH') return { query: action.payload };
      return state;
    });
    const store = createStore(reducer, { query: '' }, [debounceMw]);

    store.dispatch({ type: 'SEARCH', payload: 'a', meta: { debounce: 100 } });
    store.dispatch({ type: 'SEARCH', payload: 'ab', meta: { debounce: 100 } });
    store.dispatch({ type: 'SEARCH', payload: 'abc', meta: { debounce: 100 } });

    await vi.advanceTimersByTimeAsync(150);

    // Only last action should be dispatched
    expect(store.getState().query).toBe('abc');
  });
});

describe('Validation Middleware Tests', () => {
  it('should validate actions', () => {
    const validationMw = createValidationMiddleware({
      ADD_USER: (payload) => ({
        valid: payload.email?.includes('@'),
        errors: payload.email?.includes('@') ? [] : ['Invalid email'],
      }),
    });

    const reducer = (state, action) => {
      if (action.type === 'ADD_USER') return { user: action.payload };
      return state;
    };
    const store = createStore(reducer, { user: null }, [validationMw]);

    const result = store.dispatch({
      type: 'ADD_USER',
      payload: { email: 'invalid' },
    });

    expect(result.type).toBe('ADD_USER_VALIDATION_ERROR');
    expect(result.payload).toContain('Invalid email');
  });

  it('should pass valid actions', () => {
    const validationMw = createValidationMiddleware({
      ADD_USER: (payload) => ({
        valid: payload.email?.includes('@'),
        errors: [],
      }),
    });

    const reducer = (state, action) => {
      if (action.type === 'ADD_USER') return { user: action.payload };
      return state;
    };
    const store = createStore(reducer, { user: null }, [validationMw]);

    store.dispatch({
      type: 'ADD_USER',
      payload: { email: 'test@example.com' },
    });

    expect(store.getState().user.email).toBe('test@example.com');
  });
});

describe('Analytics Middleware Tests', () => {
  it('should track actions with meta.track', () => {
    const tracker = { track: vi.fn() };
    const analyticsMw = createAnalyticsMiddleware(tracker);
    const reducer = (state) => state;
    const store = createStore(reducer, {}, [analyticsMw]);

    store.dispatch({
      type: 'BUTTON_CLICK',
      meta: {
        track: 'user_interaction',
        trackData: { button: 'submit' },
      },
    });

    expect(tracker.track).toHaveBeenCalledWith('user_interaction', {
      action: 'BUTTON_CLICK',
      button: 'submit',
    });
  });
});

describe('Error Middleware Tests', () => {
  it('should catch and handle errors', () => {
    const errorHandler = vi.fn();
    const errorMw = createErrorMiddleware(errorHandler);

    const reducer = (state, action) => {
      if (action.type === 'FAIL') throw new Error('Reducer error');
      return state;
    };
    const store = createStore(reducer, {}, [errorMw]);

    const result = store.dispatch({ type: 'FAIL' });

    expect(errorHandler).toHaveBeenCalled();
    expect(result.type).toBe('ERROR');
  });
});
