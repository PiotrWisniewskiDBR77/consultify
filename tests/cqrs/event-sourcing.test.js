/**
 * Event Sourcing and CQRS Tests
 * Tests for event-driven architecture patterns
 * 
 * @module tests/cqrs/event-sourcing.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Event store
const createEventStore = () => {
    const streams = new Map(); // streamId -> events[]
    const subscribers = new Map(); // eventType -> handlers[]

    return {
        append: (streamId, event) => {
            if (!streams.has(streamId)) {
                streams.set(streamId, []);
            }

            const events = streams.get(streamId);
            const storedEvent = {
                ...event,
                id: crypto.randomUUID(),
                streamId,
                version: events.length + 1,
                timestamp: Date.now(),
            };

            events.push(storedEvent);

            // Notify subscribers
            const handlers = subscribers.get(event.type) || [];
            for (const handler of handlers) {
                handler(storedEvent);
            }

            return storedEvent;
        },

        getStream: (streamId, fromVersion = 0) => {
            const events = streams.get(streamId) || [];
            return events.filter(e => e.version > fromVersion);
        },

        getAll: (eventType = null) => {
            const all = [];
            for (const events of streams.values()) {
                for (const event of events) {
                    if (!eventType || event.type === eventType) {
                        all.push(event);
                    }
                }
            }
            return all.sort((a, b) => a.timestamp - b.timestamp);
        },

        subscribe: (eventType, handler) => {
            if (!subscribers.has(eventType)) {
                subscribers.set(eventType, []);
            }
            subscribers.get(eventType).push(handler);

            return () => {
                const handlers = subscribers.get(eventType);
                const idx = handlers.indexOf(handler);
                if (idx !== -1) handlers.splice(idx, 1);
            };
        },

        getVersion: (streamId) => {
            return streams.get(streamId)?.length || 0;
        },
    };
};

// Aggregate
const createAggregate = (id, applyEvent) => {
    let state = null;
    let version = 0;
    const uncommittedEvents = [];

    return {
        getId: () => id,

        getState: () => state,

        getVersion: () => version,

        getUncommittedEvents: () => [...uncommittedEvents],

        apply: (event) => {
            state = applyEvent(state, event);
            uncommittedEvents.push(event);
        },

        load: (events) => {
            for (const event of events) {
                state = applyEvent(state, event);
                version = event.version;
            }
        },

        markCommitted: () => {
            uncommittedEvents.length = 0;
        },
    };
};

// Command bus
const createCommandBus = () => {
    const handlers = new Map();
    const middleware = [];

    return {
        register: (commandType, handler) => {
            handlers.set(commandType, handler);
        },

        use: (fn) => {
            middleware.push(fn);
        },

        dispatch: async (command) => {
            const handler = handlers.get(command.type);
            if (!handler) {
                throw new Error(`No handler for command: ${command.type}`);
            }

            let index = 0;
            const next = async (cmd) => {
                if (index < middleware.length) {
                    return middleware[index++](cmd, next);
                }
                return handler(cmd);
            };

            return next(command);
        },
    };
};

// Query bus
const createQueryBus = () => {
    const handlers = new Map();

    return {
        register: (queryType, handler) => {
            handlers.set(queryType, handler);
        },

        query: async (query) => {
            const handler = handlers.get(query.type);
            if (!handler) {
                throw new Error(`No handler for query: ${query.type}`);
            }
            return handler(query);
        },
    };
};

// Read model projector
const createProjector = () => {
    const projections = new Map();

    return {
        define: (name, eventHandlers, initialState = {}) => {
            projections.set(name, {
                state: { ...initialState },
                handlers: eventHandlers,
            });
        },

        project: (event) => {
            for (const [, projection] of projections) {
                const handler = projection.handlers[event.type];
                if (handler) {
                    projection.state = handler(projection.state, event);
                }
            }
        },

        getProjection: (name) => {
            return projections.get(name)?.state;
        },

        reset: (name) => {
            const projection = projections.get(name);
            if (projection) {
                projection.state = {};
            }
        },
    };
};

describe('Event Store Tests', () => {
    let store;

    beforeEach(() => {
        store = createEventStore();
    });

    it('should append events', () => {
        store.append('order-1', { type: 'OrderCreated', data: { amount: 100 } });
        store.append('order-1', { type: 'OrderPaid', data: {} });

        const events = store.getStream('order-1');

        expect(events).toHaveLength(2);
        expect(events[0].version).toBe(1);
        expect(events[1].version).toBe(2);
    });

    it('should get events from version', () => {
        store.append('order-1', { type: 'E1' });
        store.append('order-1', { type: 'E2' });
        store.append('order-1', { type: 'E3' });

        const events = store.getStream('order-1', 1);

        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('E2');
    });

    it('should subscribe to events', () => {
        const handler = vi.fn();
        store.subscribe('OrderCreated', handler);

        store.append('order-1', { type: 'OrderCreated' });

        expect(handler).toHaveBeenCalled();
    });

    it('should get all by type', () => {
        store.append('o1', { type: 'OrderCreated' });
        store.append('o2', { type: 'OrderCreated' });
        store.append('o1', { type: 'OrderPaid' });

        const events = store.getAll('OrderCreated');

        expect(events).toHaveLength(2);
    });
});

describe('Aggregate Tests', () => {
    let aggregate;
    const applyEvent = (state, event) => {
        switch (event.type) {
            case 'Created':
                return { ...state, created: true };
            case 'Updated':
                return { ...state, value: event.value };
            default:
                return state;
        }
    };

    beforeEach(() => {
        aggregate = createAggregate('agg-1', applyEvent);
    });

    it('should apply events', () => {
        aggregate.apply({ type: 'Created' });
        aggregate.apply({ type: 'Updated', value: 42 });

        expect(aggregate.getState().created).toBe(true);
        expect(aggregate.getState().value).toBe(42);
    });

    it('should track uncommitted events', () => {
        aggregate.apply({ type: 'Created' });

        expect(aggregate.getUncommittedEvents()).toHaveLength(1);

        aggregate.markCommitted();

        expect(aggregate.getUncommittedEvents()).toHaveLength(0);
    });

    it('should load from events', () => {
        aggregate.load([
            { type: 'Created', version: 1 },
            { type: 'Updated', value: 10, version: 2 },
        ]);

        expect(aggregate.getVersion()).toBe(2);
        expect(aggregate.getState().value).toBe(10);
    });
});

describe('Command Bus Tests', () => {
    let bus;

    beforeEach(() => {
        bus = createCommandBus();
    });

    it('should dispatch to handler', async () => {
        const handler = vi.fn(() => 'done');
        bus.register('CreateOrder', handler);

        const result = await bus.dispatch({ type: 'CreateOrder', amount: 100 });

        expect(handler).toHaveBeenCalled();
        expect(result).toBe('done');
    });

    it('should apply middleware', async () => {
        const log = [];

        bus.use(async (cmd, next) => {
            log.push('before');
            const result = await next(cmd);
            log.push('after');
            return result;
        });

        bus.register('Test', () => { log.push('handler'); });
        await bus.dispatch({ type: 'Test' });

        expect(log).toEqual(['before', 'handler', 'after']);
    });
});

describe('Projector Tests', () => {
    let projector;

    beforeEach(() => {
        projector = createProjector();
    });

    it('should project events', () => {
        projector.define('orderCount', {
            OrderCreated: (state) => ({ ...state, count: (state.count || 0) + 1 }),
        });

        projector.project({ type: 'OrderCreated' });
        projector.project({ type: 'OrderCreated' });

        expect(projector.getProjection('orderCount').count).toBe(2);
    });
});
