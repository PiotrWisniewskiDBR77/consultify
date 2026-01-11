/**
 * RPC (Remote Procedure Call) Tests
 * Tests for RPC client/server patterns
 *
 * @module tests/rpc/rpc-client.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// RPC Client implementation
const createRPCClient = (transport) => {
  let requestId = 0;
  const pendingRequests = new Map();
  const middleware = [];

  return {
    call: async (method, params = {}, options = {}) => {
      const { timeout = 30000 } = options;
      const id = ++requestId;

      // Build request
      let request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      // Apply middleware
      for (const fn of middleware) {
        request = await fn(request);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRequests.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }, timeout);

        pendingRequests.set(id, { resolve, reject, timer, method });

        transport.send(request).catch((error) => {
          clearTimeout(timer);
          pendingRequests.delete(id);
          reject(error);
        });
      });
    },

    notify: async (method, params = {}) => {
      const request = {
        jsonrpc: '2.0',
        method,
        params,
      };
      await transport.send(request);
    },

    batch: async (calls) => {
      const requests = calls.map((call, index) => ({
        jsonrpc: '2.0',
        id: ++requestId,
        method: call.method,
        params: call.params || {},
      }));

      const response = await transport.send(requests);
      return response;
    },

    handleResponse: (response) => {
      if (Array.isArray(response)) {
        response.forEach((r) => this.handleResponse(r));
        return;
      }

      const pending = pendingRequests.get(response.id);
      if (!pending) return;

      clearTimeout(pending.timer);
      pendingRequests.delete(response.id);

      if (response.error) {
        const error = new Error(response.error.message);
        error.code = response.error.code;
        error.data = response.error.data;
        pending.reject(error);
      } else {
        pending.resolve(response.result);
      }
    },

    use: (middlewareFn) => {
      middleware.push(middlewareFn);
    },

    getPendingCount: () => pendingRequests.size,
  };
};

// RPC Server implementation
const createRPCServer = () => {
  const methods = new Map();
  const beforeHooks = [];
  const afterHooks = [];

  const handleRequest = async (request) => {
    // Validate JSON-RPC
    if (request.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32600, message: 'Invalid Request' },
      };
    }

    const handler = methods.get(request.method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'Method not found' },
      };
    }

    try {
      // Before hooks
      let context = { request, params: request.params };
      for (const hook of beforeHooks) {
        context = await hook(context);
      }

      // Execute method
      const result = await handler(context.params, context);

      // After hooks
      let response = { jsonrpc: '2.0', id: request.id, result };
      for (const hook of afterHooks) {
        response = await hook(response, context);
      }

      return response;
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: error.code || -32603,
          message: error.message,
          data: error.data,
        },
      };
    }
  };

  return {
    register: (method, handler) => {
      methods.set(method, handler);
    },

    unregister: (method) => {
      methods.delete(method);
    },

    handle: async (request) => {
      // Handle batch
      if (Array.isArray(request)) {
        return Promise.all(request.map(handleRequest));
      }

      // Handle notification (no id)
      if (request.id === undefined) {
        await handleRequest(request);
        return null;
      }

      return handleRequest(request);
    },

    before: (hook) => {
      beforeHooks.push(hook);
    },

    after: (hook) => {
      afterHooks.push(hook);
    },

    getMethods: () => [...methods.keys()],
  };
};

// Transport mock
const createMockTransport = (server) => {
  return {
    send: async (request) => {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 5));
      return server.handle(request);
    },
  };
};

describe('RPC Client Tests', () => {
  let server;
  let transport;
  let client;

  beforeEach(() => {
    server = createRPCServer();
    transport = createMockTransport(server);
    client = createRPCClient(transport);

    // Register test methods
    server.register('add', ({ a, b }) => a + b);
    server.register('multiply', ({ a, b }) => a * b);
    server.register('echo', (params) => params);
    server.register('slow', async () => {
      await new Promise((r) => setTimeout(r, 100));
      return 'done';
    });
    server.register('error', () => {
      throw new Error('Test error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CALL
  // ═══════════════════════════════════════════════════════════════════

  describe('call', () => {
    it('should call remote method', async () => {
      const result = await client.call('add', { a: 2, b: 3 });
      expect(result).toBe(5);
    });

    it('should pass parameters', async () => {
      const result = await client.call('echo', { message: 'hello' });
      expect(result.message).toBe('hello');
    });

    it('should handle response', async () => {
      const promise = client.call('add', { a: 1, b: 1 });

      // Simulate async response
      setTimeout(() => {
        client.handleResponse({
          jsonrpc: '2.0',
          id: 1,
          result: 2,
        });
      }, 10);

      // Original call should also work
      const result = await client.call('add', { a: 1, b: 1 });
      expect(result).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle method error', async () => {
      await expect(client.call('error')).rejects.toThrow('Test error');
    });

    it('should handle method not found', async () => {
      await expect(client.call('nonexistent')).rejects.toThrow('not found');
    });

    it('should timeout long requests', async () => {
      await expect(client.call('slow', {}, { timeout: 50 })).rejects.toThrow('timeout');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // NOTIFY
  // ═══════════════════════════════════════════════════════════════════

  describe('notify', () => {
    it('should send notification without waiting for response', async () => {
      const sendSpy = vi.spyOn(transport, 'send');

      await client.notify('echo', { data: 'test' });

      expect(sendSpy).toHaveBeenCalledWith(expect.not.objectContaining({ id: expect.any(Number) }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BATCH
  // ═══════════════════════════════════════════════════════════════════

  describe('batch', () => {
    it('should send batch requests', async () => {
      const results = await client.batch([
        { method: 'add', params: { a: 1, b: 2 } },
        { method: 'multiply', params: { a: 3, b: 4 } },
      ]);

      expect(results.length).toBe(2);
      expect(results[0].result).toBe(3);
      expect(results[1].result).toBe(12);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('middleware', () => {
    it('should apply middleware', async () => {
      client.use((request) => ({
        ...request,
        params: { ...request.params, timestamp: 123 },
      }));

      const result = await client.call('echo', { data: 'test' });

      expect(result.timestamp).toBe(123);
    });
  });
});

describe('RPC Server Tests', () => {
  let server;

  beforeEach(() => {
    server = createRPCServer();
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════

  describe('register', () => {
    it('should register method', () => {
      server.register('test', () => 'result');

      expect(server.getMethods()).toContain('test');
    });

    it('should unregister method', () => {
      server.register('test', () => {});
      server.unregister('test');

      expect(server.getMethods()).not.toContain('test');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HANDLE
  // ═══════════════════════════════════════════════════════════════════

  describe('handle', () => {
    it('should handle valid request', async () => {
      server.register('greet', ({ name }) => `Hello, ${name}!`);

      const response = await server.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'greet',
        params: { name: 'World' },
      });

      expect(response.result).toBe('Hello, World!');
    });

    it('should return error for invalid JSON-RPC version', async () => {
      const response = await server.handle({
        jsonrpc: '1.0',
        id: 1,
        method: 'test',
      });

      expect(response.error.code).toBe(-32600);
    });

    it('should return error for unknown method', async () => {
      const response = await server.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown',
      });

      expect(response.error.code).toBe(-32601);
    });

    it('should handle batch requests', async () => {
      server.register('double', ({ n }) => n * 2);

      const responses = await server.handle([
        { jsonrpc: '2.0', id: 1, method: 'double', params: { n: 2 } },
        { jsonrpc: '2.0', id: 2, method: 'double', params: { n: 3 } },
      ]);

      expect(responses[0].result).toBe(4);
      expect(responses[1].result).toBe(6);
    });

    it('should handle notifications (no response)', async () => {
      const handler = vi.fn();
      server.register('log', handler);

      const response = await server.handle({
        jsonrpc: '2.0',
        method: 'log',
        params: { message: 'test' },
      });

      expect(response).toBeNull();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HOOKS
  // ═══════════════════════════════════════════════════════════════════

  describe('hooks', () => {
    it('should run before hooks', async () => {
      server.register('test', (params) => params.modified);
      server.before((ctx) => ({
        ...ctx,
        params: { ...ctx.params, modified: true },
      }));

      const response = await server.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(response.result).toBe(true);
    });

    it('should run after hooks', async () => {
      server.register('test', () => 'result');
      server.after((response) => ({
        ...response,
        result: response.result.toUpperCase(),
      }));

      const response = await server.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      });

      expect(response.result).toBe('RESULT');
    });
  });
});
