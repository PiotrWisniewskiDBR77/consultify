/**
 * Server-Sent Events (SSE) Tests
 * Tests for SSE client and event handling
 *
 * @module tests/sse/sse-client.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SSE client implementation
const createSSEClient = (url, options = {}) => {
  const { withCredentials = false, retry = 3000 } = options;

  let eventSource = null;
  let reconnectAttempts = 0;
  let isConnected = false;
  let lastEventId = null;

  const listeners = new Map();
  const globalListeners = {
    open: [],
    error: [],
    message: [],
  };

  const emit = (type, event) => {
    const typeListeners = listeners.get(type) || [];
    typeListeners.forEach((fn) => fn(event));

    if (type !== 'open' && type !== 'error') {
      globalListeners.message.forEach((fn) => fn(event));
    }
  };

  return {
    connect: () => {
      return new Promise((resolve, reject) => {
        // Mock EventSource
        eventSource = {
          readyState: 0, // CONNECTING
          close: vi.fn(),
          onopen: null,
          onerror: null,
          onmessage: null,
          addEventListener: vi.fn((type, handler) => {
            if (!listeners.has(type)) {
              listeners.set(type, []);
            }
            listeners.get(type).push(handler);
          }),
          removeEventListener: vi.fn((type, handler) => {
            const typeListeners = listeners.get(type);
            if (typeListeners) {
              const index = typeListeners.indexOf(handler);
              if (index !== -1) typeListeners.splice(index, 1);
            }
          }),
        };

        // Simulate connection
        setTimeout(() => {
          eventSource.readyState = 1; // OPEN
          isConnected = true;
          reconnectAttempts = 0;
          globalListeners.open.forEach((fn) => fn({ type: 'open' }));
          resolve(this);
        }, 10);
      });
    },

    disconnect: () => {
      if (eventSource) {
        eventSource.close();
        eventSource.readyState = 2; // CLOSED
        eventSource = null;
      }
      isConnected = false;
      listeners.clear();
    },

    on: (eventType, handler) => {
      if (['open', 'error', 'message'].includes(eventType)) {
        globalListeners[eventType].push(handler);
      } else {
        eventSource?.addEventListener(eventType, handler);
      }

      return () => this.off(eventType, handler);
    },

    off: (eventType, handler) => {
      if (['open', 'error', 'message'].includes(eventType)) {
        const arr = globalListeners[eventType];
        const index = arr.indexOf(handler);
        if (index !== -1) arr.splice(index, 1);
      } else {
        eventSource?.removeEventListener(eventType, handler);
      }
    },

    // Simulate receiving an event (for testing)
    _simulateEvent: (type, data, id) => {
      const event = {
        type,
        data: typeof data === 'string' ? data : JSON.stringify(data),
        lastEventId: id || '',
        origin: url,
      };

      if (id) lastEventId = id;

      emit(type, event);
    },

    // Simulate error (for testing)
    _simulateError: (error) => {
      globalListeners.error.forEach((fn) => fn(error));
    },

    getState: () => ({
      connected: isConnected,
      readyState: eventSource?.readyState ?? -1,
      lastEventId,
      reconnectAttempts,
    }),

    isConnected: () => isConnected,
  };
};

// Event stream parser
const createEventStreamParser = () => {
  let buffer = '';
  let eventType = 'message';
  let eventData = [];
  let eventId = '';

  return {
    parse: (chunk) => {
      buffer += chunk;
      const events = [];
      const lines = buffer.split('\n');

      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line === '') {
          // Empty line = dispatch event
          if (eventData.length > 0) {
            events.push({
              type: eventType,
              data: eventData.join('\n'),
              id: eventId,
            });
          }
          // Reset
          eventType = 'message';
          eventData = [];
        } else if (line.startsWith(':')) {
          // Comment, ignore
        } else if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData.push(line.slice(5).trim());
        } else if (line.startsWith('id:')) {
          eventId = line.slice(3).trim();
        } else if (line.startsWith('retry:')) {
          // Retry interval, could be handled
        }
      }

      return events;
    },

    reset: () => {
      buffer = '';
      eventType = 'message';
      eventData = [];
      eventId = '';
    },
  };
};

// SSE message formatter (server-side helper)
const createSSEFormatter = () => {
  return {
    format: (event) => {
      let message = '';

      if (event.id) {
        message += `id: ${event.id}\n`;
      }
      if (event.type && event.type !== 'message') {
        message += `event: ${event.type}\n`;
      }
      if (event.retry) {
        message += `retry: ${event.retry}\n`;
      }

      const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);

      // Split data by newlines
      data.split('\n').forEach((line) => {
        message += `data: ${line}\n`;
      });

      message += '\n';
      return message;
    },

    comment: (text) => {
      return `: ${text}\n\n`;
    },

    keepAlive: () => {
      return ':\n\n';
    },
  };
};

describe('SSE Client Tests', () => {
  let sseClient;

  beforeEach(async () => {
    sseClient = createSSEClient('https://api.example.com/events');
    await sseClient.connect();
  });

  afterEach(() => {
    sseClient?.disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════

  describe('Connection', () => {
    it('should connect to SSE endpoint', () => {
      expect(sseClient.isConnected()).toBe(true);
    });

    it('should emit open event', async () => {
      const newClient = createSSEClient('https://api.example.com/events');
      const openHandler = vi.fn();
      newClient.on('open', openHandler);

      await newClient.connect();

      expect(openHandler).toHaveBeenCalled();
      newClient.disconnect();
    });

    it('should disconnect', () => {
      sseClient.disconnect();

      expect(sseClient.isConnected()).toBe(false);
    });

    it('should get connection state', () => {
      const state = sseClient.getState();

      expect(state.connected).toBe(true);
      expect(state.readyState).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Events', () => {
    it('should receive message event', () => {
      const handler = vi.fn();
      sseClient.on('message', handler);

      sseClient._simulateEvent('message', { text: 'Hello' });

      expect(handler).toHaveBeenCalled();
    });

    it('should receive custom event type', () => {
      const handler = vi.fn();
      sseClient.on('notification', handler);

      sseClient._simulateEvent('notification', { title: 'Alert' });

      expect(handler).toHaveBeenCalled();
    });

    it('should track last event ID', () => {
      sseClient._simulateEvent('message', { text: 'Test' }, 'event-123');

      expect(sseClient.getState().lastEventId).toBe('event-123');
    });

    it('should remove event listener', () => {
      const handler = vi.fn();
      const unsubscribe = sseClient.on('message', handler);

      unsubscribe();
      sseClient._simulateEvent('message', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle error event', () => {
      const errorHandler = vi.fn();
      sseClient.on('error', errorHandler);

      sseClient._simulateError(new Error('Connection lost'));

      expect(errorHandler).toHaveBeenCalled();
    });
  });
});

describe('Event Stream Parser Tests', () => {
  let parser;

  beforeEach(() => {
    parser = createEventStreamParser();
  });

  it('should parse simple event', () => {
    const events = parser.parse('data: Hello World\n\n');

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('message');
    expect(events[0].data).toBe('Hello World');
  });

  it('should parse event with type', () => {
    const events = parser.parse('event: notification\ndata: Test\n\n');

    expect(events[0].type).toBe('notification');
  });

  it('should parse event with ID', () => {
    const events = parser.parse('id: 123\ndata: Test\n\n');

    expect(events[0].id).toBe('123');
  });

  it('should parse multi-line data', () => {
    const events = parser.parse('data: Line 1\ndata: Line 2\ndata: Line 3\n\n');

    expect(events[0].data).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should handle chunked input', () => {
    parser.parse('data: Hello');
    const events = parser.parse(' World\n\n');

    expect(events[0].data).toBe('Hello World');
  });

  it('should parse multiple events', () => {
    const events = parser.parse('data: Event 1\n\ndata: Event 2\n\n');

    expect(events.length).toBe(2);
  });

  it('should ignore comments', () => {
    const events = parser.parse(': this is a comment\ndata: Test\n\n');

    expect(events.length).toBe(1);
    expect(events[0].data).toBe('Test');
  });
});

describe('SSE Formatter Tests', () => {
  let formatter;

  beforeEach(() => {
    formatter = createSSEFormatter();
  });

  it('should format simple event', () => {
    const result = formatter.format({ data: 'Hello' });

    expect(result).toBe('data: Hello\n\n');
  });

  it('should format event with type', () => {
    const result = formatter.format({ type: 'notification', data: 'Test' });

    expect(result).toContain('event: notification\n');
    expect(result).toContain('data: Test\n');
  });

  it('should format event with ID', () => {
    const result = formatter.format({ id: '123', data: 'Test' });

    expect(result).toContain('id: 123\n');
  });

  it('should format JSON data', () => {
    const result = formatter.format({ data: { key: 'value' } });

    expect(result).toContain('data: {"key":"value"}\n');
  });

  it('should format multi-line data', () => {
    const result = formatter.format({ data: 'Line 1\nLine 2' });

    expect(result).toContain('data: Line 1\n');
    expect(result).toContain('data: Line 2\n');
  });

  it('should format comment', () => {
    const result = formatter.comment('ping');

    expect(result).toBe(': ping\n\n');
  });

  it('should format keep-alive', () => {
    const result = formatter.keepAlive();

    expect(result).toBe(':\n\n');
  });
});
