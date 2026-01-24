/**
 * WebSocket Client Tests
 * Tests for WebSocket connection management and messaging
 *
 * @module tests/websocket/websocket-client.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// WebSocket client implementation
const createWebSocketClient = (url, options = {}) => {
  const {
    reconnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    protocols = [],
  } = options;

  let ws = null;
  let reconnectAttempts = 0;
  let heartbeatTimer = null;
  let isIntentionallyClosed = false;

  const listeners = {
    open: [],
    close: [],
    message: [],
    error: [],
    reconnect: [],
  };

  const messageHandlers = new Map();

  const emit = (event, data) => {
    listeners[event]?.forEach((fn) => fn(data));
  };

  const startHeartbeat = () => {
    if (heartbeatInterval > 0) {
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === 1) {
          // OPEN
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, heartbeatInterval);
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const client = {
    connect: () => {
      return new Promise((resolve, reject) => {
        isIntentionallyClosed = false;

        // Mock WebSocket for testing
        ws = {
          readyState: 0, // CONNECTING
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onclose: null,
          onmessage: null,
          onerror: null,
        };

        // Simulate connection
        setTimeout(() => {
          ws.readyState = 1; // OPEN
          ws.onopen?.({ type: 'open' });
          emit('open', { url });
          reconnectAttempts = 0;
          startHeartbeat();
          resolve(client);
        }, 10);
      });
    },

    disconnect: () => {
      isIntentionallyClosed = true;
      stopHeartbeat();
      ws?.close();
      ws = null;
    },

    send: (type, payload) => {
      if (!ws || ws.readyState !== 1) {
        throw new Error('WebSocket is not connected');
      }

      const message = JSON.stringify({ type, payload, timestamp: Date.now() });
      ws.send(message);
      return true;
    },

    sendRaw: (data) => {
      if (!ws || ws.readyState !== 1) {
        throw new Error('WebSocket is not connected');
      }
      ws.send(data);
      return true;
    },

    on: (event, handler) => {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
      return () => client.off(event, handler);
    },

    off: (event, handler) => {
      if (listeners[event]) {
        const index = listeners[event].indexOf(handler);
        if (index !== -1) listeners[event].splice(index, 1);
      }
    },

    onMessage: (type, handler) => {
      if (!messageHandlers.has(type)) {
        messageHandlers.set(type, []);
      }
      messageHandlers.get(type).push(handler);
      return () => {
        const handlers = messageHandlers.get(type);
        const index = handlers?.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      };
    },

    // Simulate receiving a message (for testing)
    _simulateMessage: (data) => {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      emit('message', message);

      const handlers = messageHandlers.get(message.type);
      handlers?.forEach((fn) => fn(message.payload, message));
    },

    // Simulate connection error (for testing)
    _simulateError: (error) => {
      emit('error', error);

      if (reconnect && !isIntentionallyClosed && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        emit('reconnect', { attempt: reconnectAttempts, max: maxReconnectAttempts });
        setTimeout(() => client.connect(), reconnectInterval);
      }
    },

    // Simulate close (for testing)
    _simulateClose: (code, reason) => {
      ws.readyState = 3; // CLOSED
      stopHeartbeat();
      emit('close', { code, reason });
    },

    getState: () => ({
      connected: ws?.readyState === 1,
      readyState: ws?.readyState ?? -1,
      reconnectAttempts,
      url,
    }),

    isConnected: () => ws?.readyState === 1,
  };

  return client;
};

// WebSocket room manager
const createRoomManager = (wsClient) => {
  const rooms = new Set();
  const roomListeners = new Map();

  return {
    join: (roomId) => {
      if (rooms.has(roomId)) return false;

      wsClient.send('room:join', { roomId });
      rooms.add(roomId);
      return true;
    },

    leave: (roomId) => {
      if (!rooms.has(roomId)) return false;

      wsClient.send('room:leave', { roomId });
      rooms.delete(roomId);
      roomListeners.delete(roomId);
      return true;
    },

    broadcast: (roomId, message) => {
      if (!rooms.has(roomId)) {
        throw new Error(`Not a member of room: ${roomId}`);
      }
      wsClient.send('room:message', { roomId, message });
    },

    onRoomMessage: (roomId, handler) => {
      if (!roomListeners.has(roomId)) {
        roomListeners.set(roomId, []);
      }
      roomListeners.get(roomId).push(handler);

      return () => {
        const handlers = roomListeners.get(roomId);
        const index = handlers?.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      };
    },

    getRooms: () => [...rooms],

    isInRoom: (roomId) => rooms.has(roomId),

    leaveAll: () => {
      for (const roomId of rooms) {
        wsClient.send('room:leave', { roomId });
      }
      rooms.clear();
      roomListeners.clear();
    },
  };
};

describe('WebSocket Client Tests', () => {
  let wsClient;

  beforeEach(async () => {
    wsClient = createWebSocketClient('wss://example.com/ws');
    await wsClient.connect();
  });

  afterEach(() => {
    wsClient?.disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════

  describe('Connection', () => {
    it('should connect to WebSocket server', async () => {
      expect(wsClient.isConnected()).toBe(true);
    });

    it('should emit open event', async () => {
      const newClient = createWebSocketClient('wss://example.com/ws');
      const openHandler = vi.fn();
      newClient.on('open', openHandler);

      await newClient.connect();

      expect(openHandler).toHaveBeenCalled();
      newClient.disconnect();
    });

    it('should disconnect', () => {
      wsClient.disconnect();

      expect(wsClient.isConnected()).toBe(false);
    });

    it('should get connection state', () => {
      const state = wsClient.getState();

      expect(state.connected).toBe(true);
      expect(state.readyState).toBe(1);
      expect(state.url).toBe('wss://example.com/ws');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGING
  // ═══════════════════════════════════════════════════════════════════

  describe('Messaging', () => {
    it('should send message', () => {
      const result = wsClient.send('chat', { text: 'Hello' });

      expect(result).toBe(true);
    });

    it('should throw when sending on closed connection', () => {
      wsClient.disconnect();

      expect(() => wsClient.send('chat', {})).toThrow('not connected');
    });

    it('should receive message', () => {
      const handler = vi.fn();
      wsClient.on('message', handler);

      wsClient._simulateMessage({ type: 'chat', payload: { text: 'Hi' } });

      expect(handler).toHaveBeenCalled();
    });

    it('should handle typed messages', () => {
      const chatHandler = vi.fn();
      wsClient.onMessage('chat', chatHandler);

      wsClient._simulateMessage({ type: 'chat', payload: { text: 'Hello' } });
      wsClient._simulateMessage({ type: 'notification', payload: {} });

      expect(chatHandler).toHaveBeenCalledTimes(1);
      expect(chatHandler).toHaveBeenCalledWith({ text: 'Hello' }, expect.any(Object));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENT HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Event Handling', () => {
    it('should add event listener', () => {
      const handler = vi.fn();
      wsClient.on('message', handler);

      wsClient._simulateMessage({ type: 'test' });

      expect(handler).toHaveBeenCalled();
    });

    it('should remove event listener', () => {
      const handler = vi.fn();
      const unsubscribe = wsClient.on('message', handler);

      unsubscribe();
      wsClient._simulateMessage({ type: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle close event', () => {
      const closeHandler = vi.fn();
      wsClient.on('close', closeHandler);

      wsClient._simulateClose(1000, 'Normal closure');

      expect(closeHandler).toHaveBeenCalledWith({ code: 1000, reason: 'Normal closure' });
    });

    it('should handle error event', () => {
      const errorHandler = vi.fn();
      wsClient.on('error', errorHandler);

      wsClient._simulateError(new Error('Connection failed'));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RECONNECTION
  // ═══════════════════════════════════════════════════════════════════

  describe('Reconnection', () => {
    it('should emit reconnect event on error', async () => {
      const reconnectHandler = vi.fn();
      wsClient.on('reconnect', reconnectHandler);

      wsClient._simulateError(new Error('Connection lost'));

      expect(reconnectHandler).toHaveBeenCalledWith({ attempt: 1, max: 5 });
    });

    it('should track reconnect attempts', () => {
      wsClient._simulateError(new Error('Error 1'));
      wsClient._simulateError(new Error('Error 2'));

      const state = wsClient.getState();
      expect(state.reconnectAttempts).toBe(2);
    });
  });
});

describe('Room Manager Tests', () => {
  let wsClient;
  let roomManager;

  beforeEach(async () => {
    wsClient = createWebSocketClient('wss://example.com/ws');
    await wsClient.connect();
    roomManager = createRoomManager(wsClient);
  });

  afterEach(() => {
    wsClient?.disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════
  // JOIN / LEAVE
  // ═══════════════════════════════════════════════════════════════════

  describe('Join / Leave', () => {
    it('should join room', () => {
      const result = roomManager.join('room-1');

      expect(result).toBe(true);
      expect(roomManager.isInRoom('room-1')).toBe(true);
    });

    it('should not join same room twice', () => {
      roomManager.join('room-1');
      const result = roomManager.join('room-1');

      expect(result).toBe(false);
    });

    it('should leave room', () => {
      roomManager.join('room-1');
      const result = roomManager.leave('room-1');

      expect(result).toBe(true);
      expect(roomManager.isInRoom('room-1')).toBe(false);
    });

    it('should get all rooms', () => {
      roomManager.join('room-1');
      roomManager.join('room-2');

      expect(roomManager.getRooms()).toEqual(['room-1', 'room-2']);
    });

    it('should leave all rooms', () => {
      roomManager.join('room-1');
      roomManager.join('room-2');
      roomManager.leaveAll();

      expect(roomManager.getRooms()).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BROADCAST
  // ═══════════════════════════════════════════════════════════════════

  describe('Broadcast', () => {
    it('should broadcast to room', () => {
      roomManager.join('room-1');

      expect(() => {
        roomManager.broadcast('room-1', { text: 'Hello' });
      }).not.toThrow();
    });

    it('should throw when not in room', () => {
      expect(() => {
        roomManager.broadcast('room-1', { text: 'Hello' });
      }).toThrow('Not a member');
    });
  });
});
