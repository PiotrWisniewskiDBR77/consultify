/**
 * Reactive Stream Tests
 * Tests for reactive programming patterns
 *
 * @module tests/reactive/reactive-streams.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple observable
const createObservable = (subscribeFn) => {
  return {
    subscribe: (observer) => {
      const normalizedObserver =
        typeof observer === 'function'
          ? { next: observer, error: () => {}, complete: () => {} }
          : {
              next: observer.next || (() => {}),
              error: observer.error || (() => {}),
              complete: observer.complete || (() => {}),
            };

      return subscribeFn(normalizedObserver);
    },

    pipe: (...operators) => {
      return operators.reduce((obs, operator) => operator(obs), this);
    },
  };
};

// Subject (multicast)
const createSubject = () => {
  const observers = new Set();
  let completed = false;

  return {
    subscribe: (observer) => {
      const normalized =
        typeof observer === 'function'
          ? { next: observer, error: () => {}, complete: () => {} }
          : observer;

      observers.add(normalized);

      return {
        unsubscribe: () => observers.delete(normalized),
      };
    },

    next: (value) => {
      if (completed) return;
      observers.forEach((o) => o.next?.(value));
    },

    error: (err) => {
      if (completed) return;
      completed = true;
      observers.forEach((o) => o.error?.(err));
    },

    complete: () => {
      if (completed) return;
      completed = true;
      observers.forEach((o) => o.complete?.());
    },

    asObservable: () =>
      createObservable((observer) => {
        observers.add(observer);
        return { unsubscribe: () => observers.delete(observer) };
      }),
  };
};

// BehaviorSubject (with initial value)
const createBehaviorSubject = (initialValue) => {
  let currentValue = initialValue;
  const subject = createSubject();

  return {
    ...subject,

    subscribe: (observer) => {
      const normalized = typeof observer === 'function' ? { next: observer } : observer;

      normalized.next?.(currentValue);
      return subject.subscribe(normalized);
    },

    next: (value) => {
      currentValue = value;
      subject.next(value);
    },

    getValue: () => currentValue,
  };
};

// Operators
const operators = {
  map: (fn) => (source) =>
    createObservable((observer) => {
      return source.subscribe({
        next: (value) => observer.next(fn(value)),
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    }),

  filter: (predicate) => (source) =>
    createObservable((observer) => {
      return source.subscribe({
        next: (value) => predicate(value) && observer.next(value),
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    }),

  take: (count) => (source) =>
    createObservable((observer) => {
      let taken = 0;

      const subscription = source.subscribe({
        next: (value) => {
          if (taken < count) {
            taken++;
            observer.next(value);
            if (taken === count) {
              observer.complete();
              subscription?.unsubscribe?.();
            }
          }
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });

      return subscription;
    }),

  skip: (count) => (source) =>
    createObservable((observer) => {
      let skipped = 0;

      return source.subscribe({
        next: (value) => {
          if (skipped >= count) {
            observer.next(value);
          } else {
            skipped++;
          }
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    }),

  debounce: (ms) => (source) =>
    createObservable((observer) => {
      let timeoutId;

      return source.subscribe({
        next: (value) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => observer.next(value), ms);
        },
        error: (err) => observer.error(err),
        complete: () => {
          clearTimeout(timeoutId);
          observer.complete();
        },
      });
    }),

  distinctUntilChanged: () => (source) =>
    createObservable((observer) => {
      let lastValue;
      let hasValue = false;

      return source.subscribe({
        next: (value) => {
          if (!hasValue || value !== lastValue) {
            hasValue = true;
            lastValue = value;
            observer.next(value);
          }
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    }),

  scan: (accumulator, seed) => (source) =>
    createObservable((observer) => {
      let acc = seed;

      return source.subscribe({
        next: (value) => {
          acc = accumulator(acc, value);
          observer.next(acc);
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    }),
};

// Creation functions
const from = (iterable) =>
  createObservable((observer) => {
    for (const value of iterable) {
      observer.next(value);
    }
    observer.complete();
    return { unsubscribe: () => {} };
  });

const interval = (ms) =>
  createObservable((observer) => {
    let count = 0;
    const id = setInterval(() => observer.next(count++), ms);
    return { unsubscribe: () => clearInterval(id) };
  });

const fromEvent = (target, eventName) =>
  createObservable((observer) => {
    const handler = (e) => observer.next(e);
    target.addEventListener(eventName, handler);
    return { unsubscribe: () => target.removeEventListener(eventName, handler) };
  });

describe('Observable Tests', () => {
  it('should emit values', () => {
    const values = [];

    const observable = createObservable((observer) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
      return { unsubscribe: () => {} };
    });

    observable.subscribe((v) => values.push(v));

    expect(values).toEqual([1, 2, 3]);
  });

  it('should support pipe', () => {
    const values = [];

    from([1, 2, 3, 4, 5])
      .pipe(
        operators.filter((x) => x % 2 === 0),
        operators.map((x) => x * 10)
      )
      .subscribe((v) => values.push(v));

    expect(values).toEqual([20, 40]);
  });
});

describe('Subject Tests', () => {
  it('should multicast', () => {
    const subject = createSubject();
    const values1 = [];
    const values2 = [];

    subject.subscribe((v) => values1.push(v));
    subject.subscribe((v) => values2.push(v));

    subject.next(1);
    subject.next(2);

    expect(values1).toEqual([1, 2]);
    expect(values2).toEqual([1, 2]);
  });

  it('should unsubscribe', () => {
    const subject = createSubject();
    const values = [];

    const sub = subject.subscribe((v) => values.push(v));

    subject.next(1);
    sub.unsubscribe();
    subject.next(2);

    expect(values).toEqual([1]);
  });
});

describe('BehaviorSubject Tests', () => {
  it('should emit initial value', () => {
    const subject = createBehaviorSubject('initial');
    const values = [];

    subject.subscribe((v) => values.push(v));

    expect(values).toEqual(['initial']);
  });

  it('should get current value', () => {
    const subject = createBehaviorSubject(0);

    subject.next(1);
    subject.next(2);

    expect(subject.getValue()).toBe(2);
  });
});

describe('Operator Tests', () => {
  it('should map values', () => {
    const values = [];

    from([1, 2, 3])
      .pipe(operators.map((x) => x * 2))
      .subscribe((v) => values.push(v));

    expect(values).toEqual([2, 4, 6]);
  });

  it('should filter values', () => {
    const values = [];

    from([1, 2, 3, 4, 5])
      .pipe(operators.filter((x) => x > 2))
      .subscribe((v) => values.push(v));

    expect(values).toEqual([3, 4, 5]);
  });

  it('should take n values', () => {
    const values = [];

    from([1, 2, 3, 4, 5])
      .pipe(operators.take(3))
      .subscribe((v) => values.push(v));

    expect(values).toEqual([1, 2, 3]);
  });

  it('should skip n values', () => {
    const values = [];

    from([1, 2, 3, 4, 5])
      .pipe(operators.skip(2))
      .subscribe((v) => values.push(v));

    expect(values).toEqual([3, 4, 5]);
  });

  it('should distinct until changed', () => {
    const values = [];

    from([1, 1, 2, 2, 3, 2, 2])
      .pipe(operators.distinctUntilChanged())
      .subscribe((v) => values.push(v));

    expect(values).toEqual([1, 2, 3, 2]);
  });

  it('should scan (reduce)', () => {
    const values = [];

    from([1, 2, 3])
      .pipe(operators.scan((acc, val) => acc + val, 0))
      .subscribe((v) => values.push(v));

    expect(values).toEqual([1, 3, 6]);
  });
});
