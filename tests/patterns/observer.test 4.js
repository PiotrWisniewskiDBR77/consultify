/**
 * Observer Pattern Tests
 * Tests for observer/subscriber patterns
 *
 * @module tests/patterns/observer.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Observable implementation
const createObservable = (initialValue) => {
  let value = initialValue;
  const observers = new Set();

  return {
    get: () => value,

    set: (newValue) => {
      const oldValue = value;
      value = newValue;

      if (oldValue !== newValue) {
        observers.forEach((fn) => fn(newValue, oldValue));
      }
    },

    subscribe: (observer) => {
      observers.add(observer);
      return () => observers.delete(observer);
    },

    subscribeOnce: (observer) => {
      const wrapper = (newValue, oldValue) => {
        observers.delete(wrapper);
        observer(newValue, oldValue);
      };
      observers.add(wrapper);
      return () => observers.delete(wrapper);
    },

    getObserverCount: () => observers.size,
  };
};

// Subject (multi-event observable)
const createSubject = () => {
  const observers = new Map();

  return {
    on: (event, observer) => {
      if (!observers.has(event)) {
        observers.set(event, new Set());
      }
      observers.get(event).add(observer);

      return () => observers.get(event)?.delete(observer);
    },

    off: (event, observer) => {
      observers.get(event)?.delete(observer);
    },

    emit: (event, data) => {
      observers.get(event)?.forEach((fn) => fn(data));
      observers.get('*')?.forEach((fn) => fn({ event, data }));
    },

    once: (event, observer) => {
      const wrapper = (data) => {
        observers.get(event).delete(wrapper);
        observer(data);
      };
      return this.on(event, wrapper);
    },

    clear: (event) => {
      if (event) {
        observers.delete(event);
      } else {
        observers.clear();
      }
    },

    getEventNames: () => [...observers.keys()],

    getListenerCount: (event) => observers.get(event)?.size || 0,
  };
};

// Reactive property
const createReactive = (target) => {
  const observers = new Map();

  const notify = (prop, newValue, oldValue) => {
    observers.get(prop)?.forEach((fn) => fn(newValue, oldValue));
    observers.get('*')?.forEach((fn) => fn({ prop, newValue, oldValue }));
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop === 'subscribe') {
        return (propName, observer) => {
          if (!observers.has(propName)) {
            observers.set(propName, new Set());
          }
          observers.get(propName).add(observer);
          return () => observers.get(propName)?.delete(observer);
        };
      }
      if (prop === 'getObservers') {
        return () => observers;
      }
      return obj[prop];
    },
    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      if (oldValue !== value) {
        notify(prop, value, oldValue);
      }
      return true;
    },
  });
};

// Computed observable
const createComputed = (dependencies, computeFn) => {
  let cachedValue;
  let isDirty = true;
  const observers = new Set();

  // Subscribe to all dependencies
  dependencies.forEach((dep) => {
    dep.subscribe(() => {
      isDirty = true;
      const newValue = computeFn();
      observers.forEach((fn) => fn(newValue, cachedValue));
      cachedValue = newValue;
    });
  });

  return {
    get: () => {
      if (isDirty) {
        cachedValue = computeFn();
        isDirty = false;
      }
      return cachedValue;
    },

    subscribe: (observer) => {
      observers.add(observer);
      return () => observers.delete(observer);
    },
  };
};

describe('Observer Pattern Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // OBSERVABLE
  // ═══════════════════════════════════════════════════════════════════

  describe('Observable', () => {
    let observable;

    beforeEach(() => {
      observable = createObservable(0);
    });

    it('should get value', () => {
      expect(observable.get()).toBe(0);
    });

    it('should set value', () => {
      observable.set(10);
      expect(observable.get()).toBe(10);
    });

    it('should notify observers on change', () => {
      const observer = vi.fn();
      observable.subscribe(observer);

      observable.set(5);

      expect(observer).toHaveBeenCalledWith(5, 0);
    });

    it('should not notify when value unchanged', () => {
      const observer = vi.fn();
      observable.subscribe(observer);

      observable.set(0);

      expect(observer).not.toHaveBeenCalled();
    });

    it('should unsubscribe', () => {
      const observer = vi.fn();
      const unsubscribe = observable.subscribe(observer);

      unsubscribe();
      observable.set(10);

      expect(observer).not.toHaveBeenCalled();
    });

    it('should subscribe once', () => {
      const observer = vi.fn();
      observable.subscribeOnce(observer);

      observable.set(1);
      observable.set(2);

      expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should count observers', () => {
      observable.subscribe(() => {});
      observable.subscribe(() => {});

      expect(observable.getObserverCount()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUBJECT
  // ═══════════════════════════════════════════════════════════════════

  describe('Subject', () => {
    let subject;

    beforeEach(() => {
      subject = createSubject();
    });

    it('should emit events', () => {
      const handler = vi.fn();
      subject.on('test', handler);

      subject.emit('test', { data: 'value' });

      expect(handler).toHaveBeenCalledWith({ data: 'value' });
    });

    it('should support multiple events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      subject.on('event1', handler1);
      subject.on('event2', handler2);

      subject.emit('event1', 'a');
      subject.emit('event2', 'b');

      expect(handler1).toHaveBeenCalledWith('a');
      expect(handler2).toHaveBeenCalledWith('b');
    });

    it('should support wildcard listener', () => {
      const handler = vi.fn();
      subject.on('*', handler);

      subject.emit('any-event', { test: true });

      expect(handler).toHaveBeenCalledWith({ event: 'any-event', data: { test: true } });
    });

    it('should unsubscribe with off', () => {
      const handler = vi.fn();
      subject.on('test', handler);
      subject.off('test', handler);

      subject.emit('test', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle once', () => {
      const handler = vi.fn();
      subject.once('test', handler);

      subject.emit('test', 'a');
      subject.emit('test', 'b');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should clear event listeners', () => {
      subject.on('test', vi.fn());
      subject.on('test', vi.fn());
      subject.clear('test');

      expect(subject.getListenerCount('test')).toBe(0);
    });

    it('should get event names', () => {
      subject.on('a', () => {});
      subject.on('b', () => {});

      expect(subject.getEventNames()).toContain('a');
      expect(subject.getEventNames()).toContain('b');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REACTIVE
  // ═══════════════════════════════════════════════════════════════════

  describe('Reactive', () => {
    let reactive;

    beforeEach(() => {
      reactive = createReactive({ name: 'John', age: 30 });
    });

    it('should get properties', () => {
      expect(reactive.name).toBe('John');
      expect(reactive.age).toBe(30);
    });

    it('should set properties', () => {
      reactive.name = 'Jane';
      expect(reactive.name).toBe('Jane');
    });

    it('should notify on property change', () => {
      const handler = vi.fn();
      reactive.subscribe('name', handler);

      reactive.name = 'Bob';

      expect(handler).toHaveBeenCalledWith('Bob', 'John');
    });

    it('should subscribe to all changes with wildcard', () => {
      const handler = vi.fn();
      reactive.subscribe('*', handler);

      reactive.name = 'Alice';

      expect(handler).toHaveBeenCalledWith({
        prop: 'name',
        newValue: 'Alice',
        oldValue: 'John',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════

  describe('Computed', () => {
    it('should compute value from dependencies', () => {
      const a = createObservable(2);
      const b = createObservable(3);

      const sum = createComputed([a, b], () => a.get() + b.get());

      expect(sum.get()).toBe(5);
    });

    it('should update when dependency changes', () => {
      const a = createObservable(2);
      const b = createObservable(3);

      const sum = createComputed([a, b], () => a.get() + b.get());
      const handler = vi.fn();
      sum.subscribe(handler);

      a.set(10);

      expect(handler).toHaveBeenCalled();
      expect(sum.get()).toBe(13);
    });

    it('should cache value', () => {
      const computeFn = vi.fn(() => 42);
      const a = createObservable(1);

      const computed = createComputed([a], computeFn);

      computed.get();
      computed.get();
      computed.get();

      expect(computeFn).toHaveBeenCalledTimes(1);
    });
  });
});
