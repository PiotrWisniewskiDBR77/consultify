/**
 * Async Iterator Tests
 * Tests for async iteration patterns
 * 
 * @module tests/async/async-iterators.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Async generator utilities
const createAsyncUtils = () => {
    return {
        // Map over async iterable
        map: async function* (iterable, fn) {
            for await (const item of iterable) {
                yield fn(item);
            }
        },

        // Filter async iterable
        filter: async function* (iterable, predicate) {
            for await (const item of iterable) {
                if (predicate(item)) {
                    yield item;
                }
            }
        },

        // Take first n items
        take: async function* (iterable, n) {
            let count = 0;
            for await (const item of iterable) {
                if (count >= n) break;
                yield item;
                count++;
            }
        },

        // Skip first n items
        skip: async function* (iterable, n) {
            let count = 0;
            for await (const item of iterable) {
                if (count >= n) {
                    yield item;
                }
                count++;
            }
        },

        // Flatten nested iterables
        flatten: async function* (iterable) {
            for await (const item of iterable) {
                if (item[Symbol.asyncIterator] || item[Symbol.iterator]) {
                    yield* item;
                } else {
                    yield item;
                }
            }
        },

        // Collect to array
        toArray: async (iterable) => {
            const result = [];
            for await (const item of iterable) {
                result.push(item);
            }
            return result;
        },

        // Reduce
        reduce: async (iterable, reducer, initial) => {
            let acc = initial;
            for await (const item of iterable) {
                acc = reducer(acc, item);
            }
            return acc;
        },

        // First matching or undefined
        find: async (iterable, predicate) => {
            for await (const item of iterable) {
                if (predicate(item)) {
                    return item;
                }
            }
            return undefined;
        },
    };
};

// Async queue
const createAsyncQueue = () => {
    const queue = [];
    const waiting = [];

    return {
        push: (item) => {
            if (waiting.length > 0) {
                const resolve = waiting.shift();
                resolve({ value: item, done: false });
            } else {
                queue.push(item);
            }
        },

        close: () => {
            while (waiting.length > 0) {
                const resolve = waiting.shift();
                resolve({ value: undefined, done: true });
            }
        },

        [Symbol.asyncIterator]() {
            return {
                next: () => {
                    if (queue.length > 0) {
                        return Promise.resolve({ value: queue.shift(), done: false });
                    }

                    return new Promise((resolve) => {
                        waiting.push(resolve);
                    });
                },
            };
        },

        getLength: () => queue.length,

        getWaitingCount: () => waiting.length,
    };
};

// Buffered async reader
const createBufferedReader = (chunkSize = 1024) => {
    let buffer = '';

    return {
        read: async function* (source) {
            for await (const chunk of source) {
                buffer += chunk;

                while (buffer.length >= chunkSize) {
                    yield buffer.slice(0, chunkSize);
                    buffer = buffer.slice(chunkSize);
                }
            }

            // Flush remaining
            if (buffer.length > 0) {
                yield buffer;
                buffer = '';
            }
        },

        getBufferSize: () => buffer.length,
    };
};

// Merge async iterables
const createAsyncMerger = () => {
    return {
        merge: async function* (...iterables) {
            const iterators = iterables.map(it => it[Symbol.asyncIterator]());
            const results = iterators.map((it, i) => it.next().then(result => ({ i, result })));

            while (results.length > 0) {
                const { i, result } = await Promise.race(results);

                if (result.done) {
                    results.splice(i, 1);
                    for (let j = i; j < results.length; j++) {
                        results[j] = results[j].then(r => ({ ...r, i: r.i - 1 }));
                    }
                } else {
                    yield result.value;
                    results[i] = iterators[i].next().then(res => ({ i, result: res }));
                }
            }
        },

        concat: async function* (...iterables) {
            for (const iterable of iterables) {
                yield* iterable;
            }
        },

        zip: async function* (...iterables) {
            const iterators = iterables.map(it => it[Symbol.asyncIterator]());

            while (true) {
                const results = await Promise.all(iterators.map(it => it.next()));

                if (results.some(r => r.done)) {
                    break;
                }

                yield results.map(r => r.value);
            }
        },
    };
};

describe('Async Utils Tests', () => {
    let utils;

    beforeEach(() => {
        utils = createAsyncUtils();
    });

    it('should map async iterable', async () => {
        async function* source() {
            yield 1;
            yield 2;
            yield 3;
        }

        const mapped = utils.map(source(), x => x * 2);
        const result = await utils.toArray(mapped);

        expect(result).toEqual([2, 4, 6]);
    });

    it('should filter async iterable', async () => {
        async function* source() {
            yield 1;
            yield 2;
            yield 3;
            yield 4;
        }

        const filtered = utils.filter(source(), x => x % 2 === 0);
        const result = await utils.toArray(filtered);

        expect(result).toEqual([2, 4]);
    });

    it('should take n items', async () => {
        async function* source() {
            yield 1;
            yield 2;
            yield 3;
            yield 4;
        }

        const taken = utils.take(source(), 2);
        const result = await utils.toArray(taken);

        expect(result).toEqual([1, 2]);
    });

    it('should skip n items', async () => {
        async function* source() {
            yield 1;
            yield 2;
            yield 3;
        }

        const skipped = utils.skip(source(), 1);
        const result = await utils.toArray(skipped);

        expect(result).toEqual([2, 3]);
    });

    it('should reduce', async () => {
        async function* source() {
            yield 1;
            yield 2;
            yield 3;
        }

        const sum = await utils.reduce(source(), (acc, x) => acc + x, 0);

        expect(sum).toBe(6);
    });

    it('should find', async () => {
        async function* source() {
            yield 1;
            yield 2;
            yield 3;
        }

        const found = await utils.find(source(), x => x > 1);

        expect(found).toBe(2);
    });
});

describe('Async Queue Tests', () => {
    let queue;

    beforeEach(() => {
        queue = createAsyncQueue();
    });

    it('should push and iterate', async () => {
        queue.push(1);
        queue.push(2);
        queue.push(3);
        queue.close();

        const results = [];
        for await (const item of queue) {
            results.push(item);
        }

        expect(results).toEqual([1, 2, 3]);
    });

    it('should wait for items', async () => {
        const promise = (async () => {
            const results = [];
            for await (const item of queue) {
                results.push(item);
                if (results.length >= 2) break;
            }
            return results;
        })();

        queue.push(1);
        await new Promise(r => setTimeout(r, 10));
        queue.push(2);

        const results = await promise;
        expect(results).toEqual([1, 2]);
    });

    it('should track length', () => {
        queue.push(1);
        queue.push(2);

        expect(queue.getLength()).toBe(2);
    });
});

describe('Async Merger Tests', () => {
    let merger;

    beforeEach(() => {
        merger = createAsyncMerger();
    });

    it('should concat iterables', async () => {
        async function* a() { yield 1; yield 2; }
        async function* b() { yield 3; yield 4; }

        const result = [];
        for await (const item of merger.concat(a(), b())) {
            result.push(item);
        }

        expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should zip iterables', async () => {
        async function* a() { yield 1; yield 2; }
        async function* b() { yield 'a'; yield 'b'; }

        const result = [];
        for await (const item of merger.zip(a(), b())) {
            result.push(item);
        }

        expect(result).toEqual([[1, 'a'], [2, 'b']]);
    });
});
