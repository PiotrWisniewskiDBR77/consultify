/**
 * Webhook Tests
 * Tests for webhook sending and receiving
 *
 * @module tests/webhook/webhook-handler.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Webhook sender implementation
const createWebhookSender = (options = {}) => {
  const { retries = 3, retryDelay = 1000, timeout = 30000 } = options;
  const queue = [];
  const history = [];

  let mockFetch = vi.fn();

  const sendWithRetry = async (webhook, attempt = 1) => {
    try {
      const response = await mockFetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': webhook.id,
          'X-Webhook-Signature': webhook.signature,
          'X-Webhook-Timestamp': webhook.timestamp,
          ...webhook.headers,
        },
        body: JSON.stringify(webhook.payload),
      });

      history.push({
        ...webhook,
        status: 'delivered',
        responseStatus: response.status,
        deliveredAt: Date.now(),
        attempts: attempt,
      });

      return { success: true, response };
    } catch (error) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelay * attempt));
        return sendWithRetry(webhook, attempt + 1);
      }

      history.push({
        ...webhook,
        status: 'failed',
        error: error.message,
        failedAt: Date.now(),
        attempts: attempt,
      });

      return { success: false, error };
    }
  };

  return {
    send: async (url, payload, options = {}) => {
      const webhook = {
        id: crypto.randomUUID(),
        url,
        payload,
        headers: options.headers || {},
        timestamp: Date.now(),
        signature: options.secret
          ? `sha256=${btoa(JSON.stringify(payload) + options.secret)}`
          : null,
      };

      return sendWithRetry(webhook);
    },

    enqueue: (url, payload, options = {}) => {
      const webhook = {
        id: crypto.randomUUID(),
        url,
        payload,
        headers: options.headers || {},
        timestamp: Date.now(),
        scheduledFor: options.delay ? Date.now() + options.delay : Date.now(),
      };

      queue.push(webhook);
      return webhook.id;
    },

    processQueue: async () => {
      const now = Date.now();
      const ready = queue.filter((w) => w.scheduledFor <= now);

      const results = [];
      for (const webhook of ready) {
        const index = queue.indexOf(webhook);
        queue.splice(index, 1);

        results.push(await sendWithRetry(webhook));
      }

      return results;
    },

    getQueueLength: () => queue.length,

    getHistory: (limit = 100) => history.slice(-limit),

    getHistoryByStatus: (status) => history.filter((h) => h.status === status),

    _setMockFetch: (fn) => {
      mockFetch = fn;
    },
  };
};

// Webhook receiver implementation
const createWebhookReceiver = (secret) => {
  const handlers = new Map();
  const receivedWebhooks = [];

  const verifySignature = (payload, signature, timestamp) => {
    if (!secret) return true;

    const expected = `sha256=${btoa(JSON.stringify(payload) + secret)}`;
    return signature === expected;
  };

  return {
    on: (eventType, handler) => {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, []);
      }
      handlers.get(eventType).push(handler);

      return () => {
        const typeHandlers = handlers.get(eventType);
        const index = typeHandlers?.indexOf(handler);
        if (index !== -1) typeHandlers.splice(index, 1);
      };
    },

    handle: async (request) => {
      const { body, headers } = request;

      // Verify signature
      const signature = headers['x-webhook-signature'];
      const timestamp = headers['x-webhook-timestamp'];

      if (!verifySignature(body, signature, timestamp)) {
        return { status: 401, body: { error: 'Invalid signature' } };
      }

      // Check timestamp (prevent replay attacks)
      if (timestamp && Date.now() - timestamp > 300000) {
        // 5 minutes
        return { status: 401, body: { error: 'Webhook expired' } };
      }

      // Store received webhook
      receivedWebhooks.push({
        id: headers['x-webhook-id'],
        payload: body,
        receivedAt: Date.now(),
      });

      // Handle by event type
      const eventType = body.event || body.type || 'default';
      const eventHandlers = handlers.get(eventType) || handlers.get('*') || [];

      try {
        for (const handler of eventHandlers) {
          await handler(body, { headers });
        }
        return { status: 200, body: { received: true } };
      } catch (error) {
        return { status: 500, body: { error: error.message } };
      }
    },

    getReceived: () => [...receivedWebhooks],

    clear: () => {
      receivedWebhooks.length = 0;
    },
  };
};

// Webhook registry
const createWebhookRegistry = () => {
  const webhooks = new Map();

  return {
    register: (id, config) => {
      webhooks.set(id, {
        id,
        url: config.url,
        events: config.events || ['*'],
        secret: config.secret,
        active: true,
        createdAt: Date.now(),
      });
      return id;
    },

    unregister: (id) => {
      return webhooks.delete(id);
    },

    get: (id) => {
      return webhooks.get(id);
    },

    list: () => {
      return [...webhooks.values()];
    },

    listByEvent: (event) => {
      return [...webhooks.values()].filter(
        (w) => w.active && (w.events.includes('*') || w.events.includes(event))
      );
    },

    enable: (id) => {
      const webhook = webhooks.get(id);
      if (webhook) webhook.active = true;
    },

    disable: (id) => {
      const webhook = webhooks.get(id);
      if (webhook) webhook.active = false;
    },
  };
};

describe('Webhook Sender Tests', () => {
  let sender;
  let mockFetch;

  beforeEach(() => {
    sender = createWebhookSender({ retries: 3, retryDelay: 10 });
    mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    sender._setMockFetch(mockFetch);
  });

  // ═══════════════════════════════════════════════════════════════════
  // SEND
  // ═══════════════════════════════════════════════════════════════════

  describe('send', () => {
    it('should send webhook', async () => {
      const result = await sender.send('https://example.com/webhook', { event: 'test' });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should include signature when secret provided', async () => {
      await sender.send('https://example.com/webhook', { data: 'test' }, { secret: 'mysecret' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringContaining('sha256='),
          }),
        })
      );
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ status: 200 });

      const result = await sender.send('https://example.com/webhook', {});

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sender.send('https://example.com/webhook', {});

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUEUE
  // ═══════════════════════════════════════════════════════════════════

  describe('queue', () => {
    it('should enqueue webhook', () => {
      const id = sender.enqueue('https://example.com/webhook', { event: 'test' });

      expect(id).toBeDefined();
      expect(sender.getQueueLength()).toBe(1);
    });

    it('should process queue', async () => {
      sender.enqueue('https://example.com/webhook', { event: 'test' });

      const results = await sender.processQueue();

      expect(results.length).toBe(1);
      expect(sender.getQueueLength()).toBe(0);
    });

    it('should delay processing', async () => {
      sender.enqueue('https://example.com/webhook', { event: 'test' }, { delay: 10000 });

      const results = await sender.processQueue();

      expect(results.length).toBe(0);
      expect(sender.getQueueLength()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════════

  describe('history', () => {
    it('should track successful deliveries', async () => {
      await sender.send('https://example.com/webhook', {});

      const history = sender.getHistory();
      expect(history[0].status).toBe('delivered');
    });

    it('should track failed deliveries', async () => {
      mockFetch.mockRejectedValue(new Error('Failed'));
      await sender.send('https://example.com/webhook', {});

      const failed = sender.getHistoryByStatus('failed');
      expect(failed.length).toBe(1);
    });
  });
});

describe('Webhook Receiver Tests', () => {
  let receiver;

  beforeEach(() => {
    receiver = createWebhookReceiver('test-secret');
  });

  // ═══════════════════════════════════════════════════════════════════
  // HANDLE
  // ═══════════════════════════════════════════════════════════════════

  describe('handle', () => {
    it('should handle valid webhook', async () => {
      const handler = vi.fn();
      receiver.on('user.created', handler);

      const result = await receiver.handle({
        body: { event: 'user.created', data: { id: 1 } },
        headers: {
          'x-webhook-signature': `sha256=${btoa(JSON.stringify({ event: 'user.created', data: { id: 1 } }) + 'test-secret')}`,
          'x-webhook-timestamp': Date.now(),
        },
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it('should reject invalid signature', async () => {
      const result = await receiver.handle({
        body: { event: 'test' },
        headers: { 'x-webhook-signature': 'invalid' },
      });

      expect(result.status).toBe(401);
    });

    it('should store received webhooks', async () => {
      await receiver.handle({
        body: { event: 'test' },
        headers: {
          'x-webhook-id': 'webhook-123',
          'x-webhook-signature': `sha256=${btoa(JSON.stringify({ event: 'test' }) + 'test-secret')}`,
        },
      });

      const received = receiver.getReceived();
      expect(received[0].id).toBe('webhook-123');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('events', () => {
    it('should handle wildcard event', async () => {
      const handler = vi.fn();
      receiver.on('*', handler);

      await receiver.handle({
        body: { event: 'any.event' },
        headers: {
          'x-webhook-signature': `sha256=${btoa(JSON.stringify({ event: 'any.event' }) + 'test-secret')}`,
        },
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe handler', async () => {
      const handler = vi.fn();
      const unsubscribe = receiver.on('test', handler);

      unsubscribe();

      await receiver.handle({
        body: { event: 'test' },
        headers: {
          'x-webhook-signature': `sha256=${btoa(JSON.stringify({ event: 'test' }) + 'test-secret')}`,
        },
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('Webhook Registry Tests', () => {
  let registry;

  beforeEach(() => {
    registry = createWebhookRegistry();
  });

  it('should register webhook', () => {
    const id = registry.register('hook-1', {
      url: 'https://example.com/webhook',
      events: ['user.created'],
    });

    expect(registry.get(id)).toBeDefined();
  });

  it('should list webhooks by event', () => {
    registry.register('hook-1', { url: 'https://a.com', events: ['user.created'] });
    registry.register('hook-2', { url: 'https://b.com', events: ['order.placed'] });
    registry.register('hook-3', { url: 'https://c.com', events: ['*'] });

    const hooks = registry.listByEvent('user.created');

    expect(hooks.length).toBe(2);
  });

  it('should disable webhook', () => {
    registry.register('hook-1', { url: 'https://example.com', events: ['test'] });
    registry.disable('hook-1');

    const hooks = registry.listByEvent('test');
    expect(hooks.length).toBe(0);
  });
});
