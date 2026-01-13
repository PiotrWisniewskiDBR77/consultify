/**
 * Mediator Pattern Tests
 * Tests for communication between components
 *
 * @module tests/mediator/mediator-pattern.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple mediator
const createMediator = () => {
  const handlers = new Map();

  return {
    register: (channel, handler) => {
      if (!handlers.has(channel)) {
        handlers.set(channel, []);
      }
      handlers.get(channel).push(handler);
    },

    unregister: (channel, handler) => {
      const channelHandlers = handlers.get(channel);
      if (channelHandlers) {
        const idx = channelHandlers.indexOf(handler);
        if (idx !== -1) channelHandlers.splice(idx, 1);
      }
    },

    send: async (channel, message) => {
      const channelHandlers = handlers.get(channel);
      if (!channelHandlers || channelHandlers.length === 0) {
        throw new Error(`No handlers for channel: ${channel}`);
      }

      // Use first handler (request/response)
      return channelHandlers[0](message);
    },

    publish: (channel, message) => {
      const channelHandlers = handlers.get(channel) || [];
      for (const handler of channelHandlers) {
        handler(message);
      }
    },

    request: async (channel, message) => {
      return this.send(channel, message);
    },

    hasHandlers: (channel) => {
      const channelHandlers = handlers.get(channel);
      return channelHandlers && channelHandlers.length > 0;
    },
  };
};

// Request/Response mediator (CQRS-like)
const createRequestMediator = () => {
  const requestHandlers = new Map();
  const notificationHandlers = new Map();
  const pipeline = [];

  return {
    registerHandler: (requestType, handler) => {
      requestHandlers.set(requestType, handler);
    },

    registerNotificationHandler: (notificationType, handler) => {
      if (!notificationHandlers.has(notificationType)) {
        notificationHandlers.set(notificationType, []);
      }
      notificationHandlers.get(notificationType).push(handler);
    },

    addPipeline: (behavior) => {
      pipeline.push(behavior);
    },

    send: async (request) => {
      const handler = requestHandlers.get(request.type);
      if (!handler) {
        throw new Error(`No handler for: ${request.type}`);
      }

      // Build pipeline
      let index = 0;
      const next = async (req) => {
        if (index < pipeline.length) {
          return pipeline[index++](req, next);
        }
        return handler(req);
      };

      return next(request);
    },

    publish: async (notification) => {
      const handlers = notificationHandlers.get(notification.type) || [];
      await Promise.all(handlers.map((h) => h(notification)));
    },
  };
};

// Event aggregator
const createEventAggregator = () => {
  const subscriptions = new Map();

  return {
    subscribe: (eventType, handler, options = {}) => {
      if (!subscriptions.has(eventType)) {
        subscriptions.set(eventType, []);
      }

      const subscription = {
        handler,
        once: options.once || false,
        priority: options.priority || 0,
      };

      const subs = subscriptions.get(eventType);
      subs.push(subscription);
      subs.sort((a, b) => b.priority - a.priority);

      return () => {
        const idx = subs.indexOf(subscription);
        if (idx !== -1) subs.splice(idx, 1);
      };
    },

    subscribeOnce: (eventType, handler) => {
      return this.subscribe(eventType, handler, { once: true });
    },

    publish: async (eventType, data) => {
      const subs = subscriptions.get(eventType) || [];
      const toRemove = [];

      for (const sub of subs) {
        await sub.handler(data);
        if (sub.once) toRemove.push(sub);
      }

      for (const sub of toRemove) {
        const idx = subs.indexOf(sub);
        if (idx !== -1) subs.splice(idx, 1);
      }
    },

    getSubscriberCount: (eventType) => {
      return subscriptions.get(eventType)?.length || 0;
    },

    clear: () => {
      subscriptions.clear();
    },
  };
};

// Component mediator (for UI components)
const createComponentMediator = () => {
  const components = new Map();
  const channels = new Map();

  return {
    register: (name, componentApi) => {
      components.set(name, componentApi);
    },

    unregister: (name) => {
      components.delete(name);
    },

    getComponent: (name) => components.get(name),

    createChannel: (name) => {
      const listeners = [];

      const channel = {
        send: (message) => {
          for (const listener of listeners) {
            listener(message);
          }
        },
        listen: (callback) => {
          listeners.push(callback);
          return () => {
            const idx = listeners.indexOf(callback);
            if (idx !== -1) listeners.splice(idx, 1);
          };
        },
      };

      channels.set(name, channel);
      return channel;
    },

    getChannel: (name) => channels.get(name),

    broadcast: (message) => {
      for (const channel of channels.values()) {
        channel.send(message);
      }
    },
  };
};

describe('Mediator Tests', () => {
  let mediator;

  beforeEach(() => {
    mediator = createMediator();
  });

  it('should register and send', async () => {
    mediator.register('greet', (name) => `Hello, ${name}!`);

    const result = await mediator.send('greet', 'World');

    expect(result).toBe('Hello, World!');
  });

  it('should publish to all handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    mediator.register('event', handler1);
    mediator.register('event', handler2);

    mediator.publish('event', { data: 'test' });

    expect(handler1).toHaveBeenCalledWith({ data: 'test' });
    expect(handler2).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should throw if no handlers', async () => {
    await expect(mediator.send('unknown', {})).rejects.toThrow('No handlers');
  });

  it('should unregister handler', () => {
    const handler = vi.fn();
    mediator.register('event', handler);
    mediator.unregister('event', handler);

    expect(mediator.hasHandlers('event')).toBe(false);
  });
});

describe('Request Mediator Tests', () => {
  let mediator;

  beforeEach(() => {
    mediator = createRequestMediator();
  });

  it('should handle request', async () => {
    mediator.registerHandler('GetUser', (req) => ({ id: req.userId, name: 'Test' }));

    const result = await mediator.send({ type: 'GetUser', userId: 1 });

    expect(result.name).toBe('Test');
  });

  it('should apply pipeline', async () => {
    const log = [];

    mediator.addPipeline(async (req, next) => {
      log.push('before');
      const result = await next(req);
      log.push('after');
      return result;
    });

    mediator.registerHandler('Test', () => {
      log.push('handler');
      return 'done';
    });

    await mediator.send({ type: 'Test' });

    expect(log).toEqual(['before', 'handler', 'after']);
  });

  it('should publish notifications', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    mediator.registerNotificationHandler('UserCreated', handler1);
    mediator.registerNotificationHandler('UserCreated', handler2);

    await mediator.publish({ type: 'UserCreated', userId: 1 });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });
});

describe('Event Aggregator Tests', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = createEventAggregator();
  });

  it('should subscribe and publish', async () => {
    const handler = vi.fn();
    aggregator.subscribe('event', handler);

    await aggregator.publish('event', { data: 'test' });

    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should handle once subscription', async () => {
    const handler = vi.fn();
    aggregator.subscribeOnce('event', handler);

    await aggregator.publish('event', 1);
    await aggregator.publish('event', 2);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should respect priority', async () => {
    const order = [];

    aggregator.subscribe('event', () => order.push('low'), { priority: 1 });
    aggregator.subscribe('event', () => order.push('high'), { priority: 10 });

    await aggregator.publish('event', {});

    expect(order).toEqual(['high', 'low']);
  });

  it('should unsubscribe', async () => {
    const handler = vi.fn();
    const unsubscribe = aggregator.subscribe('event', handler);

    unsubscribe();
    await aggregator.publish('event', {});

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Component Mediator Tests', () => {
  let mediator;

  beforeEach(() => {
    mediator = createComponentMediator();
  });

  it('should register components', () => {
    mediator.register('header', { show: vi.fn(), hide: vi.fn() });

    const header = mediator.getComponent('header');

    expect(header.show).toBeDefined();
  });

  it('should create and use channels', () => {
    const channel = mediator.createChannel('navigation');
    const listener = vi.fn();

    channel.listen(listener);
    channel.send({ route: '/home' });

    expect(listener).toHaveBeenCalledWith({ route: '/home' });
  });

  it('should broadcast to all channels', () => {
    const ch1 = mediator.createChannel('ch1');
    const ch2 = mediator.createChannel('ch2');

    const l1 = vi.fn();
    const l2 = vi.fn();

    ch1.listen(l1);
    ch2.listen(l2);

    mediator.broadcast({ type: 'global' });

    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
  });
});
