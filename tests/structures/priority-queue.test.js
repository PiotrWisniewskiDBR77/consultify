/**
 * Priority Queue Tests
 * Tests for heap-based priority queue
 * 
 * @module tests/structures/priority-queue.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Min-heap based priority queue
const createPriorityQueue = (compareFn = (a, b) => a.priority - b.priority) => {
    const heap = [];

    const parent = (i) => Math.floor((i - 1) / 2);
    const leftChild = (i) => 2 * i + 1;
    const rightChild = (i) => 2 * i + 2;

    const swap = (i, j) => {
        [heap[i], heap[j]] = [heap[j], heap[i]];
    };

    const bubbleUp = (i) => {
        while (i > 0 && compareFn(heap[i], heap[parent(i)]) < 0) {
            swap(i, parent(i));
            i = parent(i);
        }
    };

    const bubbleDown = (i) => {
        const size = heap.length;
        while (leftChild(i) < size) {
            let smallest = i;
            const left = leftChild(i);
            const right = rightChild(i);

            if (compareFn(heap[left], heap[smallest]) < 0) {
                smallest = left;
            }
            if (right < size && compareFn(heap[right], heap[smallest]) < 0) {
                smallest = right;
            }

            if (smallest === i) break;

            swap(i, smallest);
            i = smallest;
        }
    };

    return {
        enqueue: (item) => {
            heap.push(item);
            bubbleUp(heap.length - 1);
        },

        dequeue: () => {
            if (heap.length === 0) return undefined;
            if (heap.length === 1) return heap.pop();

            const result = heap[0];
            heap[0] = heap.pop();
            bubbleDown(0);

            return result;
        },

        peek: () => heap[0],

        size: () => heap.length,

        isEmpty: () => heap.length === 0,

        clear: () => {
            heap.length = 0;
        },

        toArray: () => [...heap].sort(compareFn),

        contains: (predicate) => {
            return heap.some(predicate);
        },

        remove: (predicate) => {
            const index = heap.findIndex(predicate);
            if (index === -1) return false;

            if (index === heap.length - 1) {
                heap.pop();
            } else {
                heap[index] = heap.pop();
                bubbleUp(index);
                bubbleDown(index);
            }

            return true;
        },

        updatePriority: (predicate, newPriority) => {
            const index = heap.findIndex(predicate);
            if (index === -1) return false;

            heap[index].priority = newPriority;
            bubbleUp(index);
            bubbleDown(index);

            return true;
        },
    };
};

// Delayed queue
const createDelayedQueue = () => {
    const items = [];

    return {
        add: (item, delayMs) => {
            const availableAt = Date.now() + delayMs;
            items.push({ item, availableAt });
            items.sort((a, b) => a.availableAt - b.availableAt);
        },

        poll: () => {
            if (items.length === 0) return null;

            const now = Date.now();
            if (items[0].availableAt <= now) {
                return items.shift().item;
            }

            return null;
        },

        peek: () => {
            if (items.length === 0) return null;
            return items[0].item;
        },

        getNextDelay: () => {
            if (items.length === 0) return Infinity;
            return Math.max(0, items[0].availableAt - Date.now());
        },

        size: () => items.length,

        clear: () => {
            items.length = 0;
        },
    };
};

// Bounded queue
const createBoundedQueue = (capacity) => {
    const items = [];
    const waitingPush = [];
    const waitingPop = [];

    return {
        push: async (item) => {
            if (items.length < capacity) {
                items.push(item);

                if (waitingPop.length > 0) {
                    waitingPop.shift()();
                }
            } else {
                await new Promise((resolve) => {
                    waitingPush.push(resolve);
                });
                items.push(item);

                if (waitingPop.length > 0) {
                    waitingPop.shift()();
                }
            }
        },

        pop: async () => {
            if (items.length > 0) {
                const item = items.shift();

                if (waitingPush.length > 0) {
                    waitingPush.shift()();
                }

                return item;
            }

            await new Promise((resolve) => {
                waitingPop.push(resolve);
            });

            const item = items.shift();

            if (waitingPush.length > 0) {
                waitingPush.shift()();
            }

            return item;
        },

        tryPush: (item) => {
            if (items.length < capacity) {
                items.push(item);
                return true;
            }
            return false;
        },

        tryPop: () => {
            if (items.length > 0) {
                return items.shift();
            }
            return undefined;
        },

        size: () => items.length,

        capacity: () => capacity,

        isFull: () => items.length >= capacity,

        isEmpty: () => items.length === 0,
    };
};

// Circular buffer
const createCircularBuffer = (capacity) => {
    const buffer = new Array(capacity);
    let head = 0;
    let tail = 0;
    let size = 0;

    return {
        write: (value) => {
            buffer[tail] = value;
            tail = (tail + 1) % capacity;

            if (size < capacity) {
                size++;
            } else {
                // Overwrite oldest
                head = (head + 1) % capacity;
            }
        },

        read: () => {
            if (size === 0) return undefined;

            const value = buffer[head];
            head = (head + 1) % capacity;
            size--;

            return value;
        },

        peek: () => {
            if (size === 0) return undefined;
            return buffer[head];
        },

        size: () => size,

        capacity: () => capacity,

        isFull: () => size === capacity,

        isEmpty: () => size === 0,

        toArray: () => {
            const result = [];
            let i = head;
            for (let j = 0; j < size; j++) {
                result.push(buffer[i]);
                i = (i + 1) % capacity;
            }
            return result;
        },

        clear: () => {
            head = 0;
            tail = 0;
            size = 0;
        },
    };
};

describe('Priority Queue Tests', () => {
    let pq;

    beforeEach(() => {
        pq = createPriorityQueue();
    });

    it('should enqueue and dequeue in priority order', () => {
        pq.enqueue({ value: 'low', priority: 10 });
        pq.enqueue({ value: 'high', priority: 1 });
        pq.enqueue({ value: 'medium', priority: 5 });

        expect(pq.dequeue().value).toBe('high');
        expect(pq.dequeue().value).toBe('medium');
        expect(pq.dequeue().value).toBe('low');
    });

    it('should peek without removing', () => {
        pq.enqueue({ value: 'test', priority: 1 });

        expect(pq.peek().value).toBe('test');
        expect(pq.size()).toBe(1);
    });

    it('should remove item', () => {
        pq.enqueue({ id: 1, priority: 1 });
        pq.enqueue({ id: 2, priority: 2 });
        pq.enqueue({ id: 3, priority: 3 });

        pq.remove(item => item.id === 2);

        expect(pq.size()).toBe(2);
    });

    it('should update priority', () => {
        pq.enqueue({ id: 'a', priority: 10 });
        pq.enqueue({ id: 'b', priority: 5 });

        pq.updatePriority(item => item.id === 'a', 1);

        expect(pq.peek().id).toBe('a');
    });
});

describe('Delayed Queue Tests', () => {
    let dq;

    beforeEach(() => {
        dq = createDelayedQueue();
    });

    it('should not return before delay', () => {
        dq.add('item', 1000);

        expect(dq.poll()).toBeNull();
    });

    it('should return after delay', async () => {
        dq.add('item', 10);

        await new Promise(r => setTimeout(r, 20));

        expect(dq.poll()).toBe('item');
    });

    it('should return in order', async () => {
        dq.add('second', 20);
        dq.add('first', 10);

        await new Promise(r => setTimeout(r, 30));

        expect(dq.poll()).toBe('first');
        expect(dq.poll()).toBe('second');
    });
});

describe('Bounded Queue Tests', () => {
    let bq;

    beforeEach(() => {
        bq = createBoundedQueue(3);
    });

    it('should push and pop', async () => {
        await bq.push('a');
        await bq.push('b');

        expect(await bq.pop()).toBe('a');
        expect(await bq.pop()).toBe('b');
    });

    it('should try push', () => {
        expect(bq.tryPush('a')).toBe(true);
        expect(bq.tryPush('b')).toBe(true);
        expect(bq.tryPush('c')).toBe(true);
        expect(bq.tryPush('d')).toBe(false);
    });

    it('should report full/empty', async () => {
        expect(bq.isEmpty()).toBe(true);

        await bq.push('a');
        await bq.push('b');
        await bq.push('c');

        expect(bq.isFull()).toBe(true);
    });
});

describe('Circular Buffer Tests', () => {
    let cb;

    beforeEach(() => {
        cb = createCircularBuffer(3);
    });

    it('should write and read', () => {
        cb.write(1);
        cb.write(2);

        expect(cb.read()).toBe(1);
        expect(cb.read()).toBe(2);
    });

    it('should overwrite oldest on overflow', () => {
        cb.write(1);
        cb.write(2);
        cb.write(3);
        cb.write(4); // Overwrites 1

        expect(cb.toArray()).toEqual([2, 3, 4]);
    });

    it('should report size', () => {
        cb.write(1);
        cb.write(2);

        expect(cb.size()).toBe(2);
        expect(cb.isFull()).toBe(false);

        cb.write(3);

        expect(cb.isFull()).toBe(true);
    });
});
