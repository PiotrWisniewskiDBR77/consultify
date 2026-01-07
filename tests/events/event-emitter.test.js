/**
 * Event Emitter Tests
 * Tests for event emitter/pub-sub pattern
 * 
 * @module tests/events/event-emitter.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Event emitter implementation
const createEventEmitter = () => {
    const events = new Map();
    const onceListeners = new Set();

    return {
        on: (event, listener) => {
            if (!events.has(event)) {
                events.set(event, []);
            }
            events.get(event).push(listener);

            return () => {
                const listeners = events.get(event);
                const index = listeners.indexOf(listener);
                if (index !== -1) listeners.splice(index, 1);
            };
        },

        once: (event, listener) => {
            const wrappedListener = (...args) => {
                listener(...args);
                onceListeners.delete(wrappedListener);
                const listeners = events.get(event);
                const index = listeners.indexOf(wrappedListener);
                if (index !== -1) listeners.splice(index, 1);
            };
            onceListeners.add(wrappedListener);

            if (!events.has(event)) {
                events.set(event, []);
            }
            events.get(event).push(wrappedListener);

            return () => {
                const listeners = events.get(event);
                const index = listeners.indexOf(wrappedListener);
                if (index !== -1) listeners.splice(index, 1);
            };
        },

        off: (event, listener) => {
            if (!events.has(event)) return false;

            const listeners = events.get(event);
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
                return true;
            }
            return false;
        },

        emit: (event, ...args) => {
            if (!events.has(event)) return false;

            const listeners = events.get(event);
            if (listeners.length === 0) return false;

            // Create a copy to avoid issues with listeners modifying the array
            [...listeners].forEach(listener => {
                try {
                    listener(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });

            return true;
        },

        emitAsync: async (event, ...args) => {
            if (!events.has(event)) return false;

            const listeners = events.get(event);
            if (listeners.length === 0) return false;

            await Promise.all(
                [...listeners].map(async listener => {
                    try {
                        await listener(...args);
                    } catch (error) {
                        console.error(`Error in async event listener for ${event}:`, error);
                    }
                })
            );

            return true;
        },

        removeAllListeners: (event) => {
            if (event) {
                events.delete(event);
            } else {
                events.clear();
            }
        },

        listenerCount: (event) => {
            return events.get(event)?.length || 0;
        },

        eventNames: () => {
            return [...events.keys()].filter(key => events.get(key).length > 0);
        },

        listeners: (event) => {
            return events.get(event) ? [...events.get(event)] : [];
        },

        prependListener: (event, listener) => {
            if (!events.has(event)) {
                events.set(event, []);
            }
            events.get(event).unshift(listener);

            return () => {
                const listeners = events.get(event);
                const index = listeners.indexOf(listener);
                if (index !== -1) listeners.splice(index, 1);
            };
        },
    };
};

describe('Event Emitter Tests', () => {
    let emitter;

    beforeEach(() => {
        emitter = createEventEmitter();
    });

    // ═══════════════════════════════════════════════════════════════════
    // ON / EMIT
    // ═══════════════════════════════════════════════════════════════════

    describe('on / emit', () => {
        it('should call listener on emit', () => {
            const listener = vi.fn();
            emitter.on('test', listener);

            emitter.emit('test');

            expect(listener).toHaveBeenCalled();
        });

        it('should pass arguments to listener', () => {
            const listener = vi.fn();
            emitter.on('test', listener);

            emitter.emit('test', 'arg1', 'arg2');

            expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should call multiple listeners', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            emitter.on('test', listener1);
            emitter.on('test', listener2);

            emitter.emit('test');

            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
        });

        it('should return true when listeners exist', () => {
            emitter.on('test', vi.fn());
            expect(emitter.emit('test')).toBe(true);
        });

        it('should return false when no listeners', () => {
            expect(emitter.emit('test')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ONCE
    // ═══════════════════════════════════════════════════════════════════

    describe('once', () => {
        it('should only call listener once', () => {
            const listener = vi.fn();
            emitter.once('test', listener);

            emitter.emit('test');
            emitter.emit('test');

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should remove listener after call', () => {
            emitter.once('test', vi.fn());
            emitter.emit('test');

            expect(emitter.listenerCount('test')).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // OFF
    // ═══════════════════════════════════════════════════════════════════

    describe('off', () => {
        it('should remove specific listener', () => {
            const listener = vi.fn();
            emitter.on('test', listener);
            emitter.off('test', listener);

            emitter.emit('test');

            expect(listener).not.toHaveBeenCalled();
        });

        it('should return true when removed', () => {
            const listener = vi.fn();
            emitter.on('test', listener);
            expect(emitter.off('test', listener)).toBe(true);
        });

        it('should return false when not found', () => {
            expect(emitter.off('test', vi.fn())).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // UNSUBSCRIBE RETURN
    // ═══════════════════════════════════════════════════════════════════

    describe('Unsubscribe Return', () => {
        it('should return unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = emitter.on('test', listener);

            unsubscribe();
            emitter.emit('test');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REMOVE ALL LISTENERS
    // ═══════════════════════════════════════════════════════════════════

    describe('removeAllListeners', () => {
        it('should remove all listeners for event', () => {
            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());
            emitter.on('other', vi.fn());

            emitter.removeAllListeners('test');

            expect(emitter.listenerCount('test')).toBe(0);
            expect(emitter.listenerCount('other')).toBe(1);
        });

        it('should remove all listeners when no event specified', () => {
            emitter.on('test1', vi.fn());
            emitter.on('test2', vi.fn());

            emitter.removeAllListeners();

            expect(emitter.eventNames().length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LISTENER COUNT
    // ═══════════════════════════════════════════════════════════════════

    describe('listenerCount', () => {
        it('should return correct count', () => {
            emitter.on('test', vi.fn());
            emitter.on('test', vi.fn());

            expect(emitter.listenerCount('test')).toBe(2);
        });

        it('should return 0 for unknown event', () => {
            expect(emitter.listenerCount('unknown')).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EVENT NAMES
    // ═══════════════════════════════════════════════════════════════════

    describe('eventNames', () => {
        it('should return event names', () => {
            emitter.on('event1', vi.fn());
            emitter.on('event2', vi.fn());

            const names = emitter.eventNames();

            expect(names).toContain('event1');
            expect(names).toContain('event2');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LISTENERS
    // ═══════════════════════════════════════════════════════════════════

    describe('listeners', () => {
        it('should return copy of listeners', () => {
            const fn1 = vi.fn();
            const fn2 = vi.fn();
            emitter.on('test', fn1);
            emitter.on('test', fn2);

            const listeners = emitter.listeners('test');

            expect(listeners).toHaveLength(2);
            expect(listeners).toContain(fn1);
            expect(listeners).toContain(fn2);
        });

        it('should return empty array for unknown event', () => {
            expect(emitter.listeners('unknown')).toEqual([]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PREPEND LISTENER
    // ═══════════════════════════════════════════════════════════════════

    describe('prependListener', () => {
        it('should add listener at beginning', () => {
            const order = [];
            emitter.on('test', () => order.push(1));
            emitter.prependListener('test', () => order.push(0));

            emitter.emit('test');

            expect(order).toEqual([0, 1]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EMIT ASYNC
    // ═══════════════════════════════════════════════════════════════════

    describe('emitAsync', () => {
        it('should handle async listeners', async () => {
            const results = [];
            emitter.on('test', async () => {
                await new Promise(r => setTimeout(r, 10));
                results.push(1);
            });
            emitter.on('test', async () => {
                results.push(2);
            });

            await emitter.emitAsync('test');

            expect(results).toContain(1);
            expect(results).toContain(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should continue after listener error', () => {
            const listener1 = vi.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            const listener2 = vi.fn();

            emitter.on('test', listener1);
            emitter.on('test', listener2);

            emitter.emit('test');

            expect(listener2).toHaveBeenCalled();
        });
    });
});
