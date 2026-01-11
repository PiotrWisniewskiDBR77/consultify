/**
 * Presence and Cursor Tracking Tests
 * Tests for real-time user presence in collaborative apps
 *
 * @module tests/collaboration/presence.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Presence manager
const createPresenceManager = (options = {}) => {
  const { heartbeatInterval = 30000, timeout = 60000 } = options;
  const users = new Map();
  const listeners = { join: [], leave: [], update: [] };
  let heartbeatTimer = null;

  const emit = (event, data) => {
    listeners[event]?.forEach((fn) => fn(data));
  };

  return {
    join: (userId, metadata = {}) => {
      const presence = {
        id: userId,
        metadata,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        status: 'online',
      };
      users.set(userId, presence);
      emit('join', presence);
      return presence;
    },

    leave: (userId) => {
      const user = users.get(userId);
      if (user) {
        users.delete(userId);
        emit('leave', user);
        return true;
      }
      return false;
    },

    update: (userId, updates) => {
      const user = users.get(userId);
      if (user) {
        Object.assign(user, updates, { lastSeenAt: Date.now() });
        emit('update', user);
        return user;
      }
      return null;
    },

    heartbeat: (userId) => {
      const user = users.get(userId);
      if (user) {
        user.lastSeenAt = Date.now();
        return true;
      }
      return false;
    },

    getPresence: (userId) => users.get(userId) || null,

    getAllPresent: () => [...users.values()],

    getOnlineCount: () => users.size,

    isOnline: (userId) => users.has(userId),

    on: (event, handler) => {
      listeners[event]?.push(handler);
      return () => {
        const idx = listeners[event]?.indexOf(handler);
        if (idx !== -1) listeners[event].splice(idx, 1);
      };
    },

    startHeartbeatCheck: () => {
      heartbeatTimer = setInterval(() => {
        const now = Date.now();
        for (const [userId, user] of users) {
          if (now - user.lastSeenAt > timeout) {
            this.leave(userId);
          }
        }
      }, heartbeatInterval);
    },

    stopHeartbeatCheck: () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },

    clear: () => {
      users.clear();
    },
  };
};

// Cursor tracker
const createCursorTracker = () => {
  const cursors = new Map();
  const listeners = [];

  const emit = (type, data) => {
    listeners.forEach((fn) => fn({ type, ...data }));
  };

  return {
    setCursor: (userId, position) => {
      const cursor = {
        userId,
        position,
        updatedAt: Date.now(),
      };
      cursors.set(userId, cursor);
      emit('cursor_move', { userId, position });
    },

    getCursor: (userId) => cursors.get(userId) || null,

    getAllCursors: () => [...cursors.values()],

    removeCursor: (userId) => {
      const had = cursors.delete(userId);
      if (had) {
        emit('cursor_remove', { userId });
      }
      return had;
    },

    setSelection: (userId, selection) => {
      const cursor = cursors.get(userId);
      if (cursor) {
        cursor.selection = selection;
        emit('selection_change', { userId, selection });
      }
    },

    onCursorChange: (handler) => {
      listeners.push(handler);
      return () => {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    clear: () => {
      cursors.clear();
    },
  };
};

// Awareness protocol (like y-js awareness)
const createAwareness = (localUserId) => {
  const states = new Map();
  const listeners = [];

  const emit = () => {
    listeners.forEach((fn) => fn([...states.entries()]));
  };

  return {
    localUserId,

    setLocalState: (state) => {
      states.set(localUserId, {
        ...state,
        updatedAt: Date.now(),
      });
      emit();
    },

    getLocalState: () => states.get(localUserId) || null,

    getStates: () => new Map(states),

    getState: (userId) => states.get(userId) || null,

    applyUpdate: (userId, state) => {
      if (userId !== localUserId) {
        states.set(userId, {
          ...state,
          updatedAt: Date.now(),
        });
        emit();
      }
    },

    removeState: (userId) => {
      if (states.delete(userId)) {
        emit();
      }
    },

    onChange: (handler) => {
      listeners.push(handler);
      return () => {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    destroy: () => {
      states.clear();
      listeners.length = 0;
    },
  };
};

// Room manager
const createRoomManager = () => {
  const rooms = new Map();

  const createRoom = (roomId) => ({
    id: roomId,
    presence: createPresenceManager(),
    cursors: createCursorTracker(),
    createdAt: Date.now(),
    metadata: {},
  });

  return {
    createRoom: (roomId, metadata = {}) => {
      if (rooms.has(roomId)) {
        return rooms.get(roomId);
      }
      const room = createRoom(roomId);
      room.metadata = metadata;
      rooms.set(roomId, room);
      return room;
    },

    getRoom: (roomId) => rooms.get(roomId) || null,

    deleteRoom: (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        room.presence.clear();
        room.cursors.clear();
        rooms.delete(roomId);
        return true;
      }
      return false;
    },

    joinRoom: (roomId, userId, metadata = {}) => {
      let room = rooms.get(roomId);
      if (!room) {
        room = this.createRoom(roomId);
      }
      room.presence.join(userId, metadata);
      return room;
    },

    leaveRoom: (roomId, userId) => {
      const room = rooms.get(roomId);
      if (room) {
        room.presence.leave(userId);
        room.cursors.removeCursor(userId);
        return true;
      }
      return false;
    },

    getRooms: () => [...rooms.keys()],

    getRoomCount: () => rooms.size,
  };
};

describe('Presence Manager Tests', () => {
  let presence;

  beforeEach(() => {
    presence = createPresenceManager();
  });

  it('should join and track user', () => {
    const user = presence.join('user-1', { name: 'Alice' });

    expect(user.id).toBe('user-1');
    expect(user.metadata.name).toBe('Alice');
    expect(presence.isOnline('user-1')).toBe(true);
  });

  it('should leave and remove user', () => {
    presence.join('user-1');
    presence.leave('user-1');

    expect(presence.isOnline('user-1')).toBe(false);
  });

  it('should update presence', () => {
    presence.join('user-1');
    presence.update('user-1', { status: 'away' });

    const p = presence.getPresence('user-1');
    expect(p.status).toBe('away');
  });

  it('should emit join event', () => {
    const handler = vi.fn();
    presence.on('join', handler);

    presence.join('user-1');

    expect(handler).toHaveBeenCalled();
  });

  it('should emit leave event', () => {
    const handler = vi.fn();
    presence.on('leave', handler);

    presence.join('user-1');
    presence.leave('user-1');

    expect(handler).toHaveBeenCalled();
  });

  it('should get all present users', () => {
    presence.join('user-1');
    presence.join('user-2');
    presence.join('user-3');

    expect(presence.getAllPresent().length).toBe(3);
    expect(presence.getOnlineCount()).toBe(3);
  });

  it('should track heartbeat', () => {
    presence.join('user-1');
    const before = presence.getPresence('user-1').lastSeenAt;

    // Simulate time passing
    vi.advanceTimersByTime?.(1000);
    presence.heartbeat('user-1');

    const after = presence.getPresence('user-1').lastSeenAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe('Cursor Tracker Tests', () => {
  let cursors;

  beforeEach(() => {
    cursors = createCursorTracker();
  });

  it('should set and get cursor', () => {
    cursors.setCursor('user-1', { x: 100, y: 200 });

    const cursor = cursors.getCursor('user-1');
    expect(cursor.position.x).toBe(100);
    expect(cursor.position.y).toBe(200);
  });

  it('should get all cursors', () => {
    cursors.setCursor('user-1', { x: 0, y: 0 });
    cursors.setCursor('user-2', { x: 50, y: 50 });

    expect(cursors.getAllCursors().length).toBe(2);
  });

  it('should remove cursor', () => {
    cursors.setCursor('user-1', { x: 0, y: 0 });
    cursors.removeCursor('user-1');

    expect(cursors.getCursor('user-1')).toBeNull();
  });

  it('should track selection', () => {
    cursors.setCursor('user-1', { x: 0, y: 0 });
    cursors.setSelection('user-1', { start: 0, end: 10 });

    const cursor = cursors.getCursor('user-1');
    expect(cursor.selection.start).toBe(0);
    expect(cursor.selection.end).toBe(10);
  });

  it('should notify on cursor change', () => {
    const handler = vi.fn();
    cursors.onCursorChange(handler);

    cursors.setCursor('user-1', { x: 100, y: 100 });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cursor_move',
        userId: 'user-1',
      })
    );
  });
});

describe('Awareness Tests', () => {
  let awareness;

  beforeEach(() => {
    awareness = createAwareness('local-user');
  });

  it('should set local state', () => {
    awareness.setLocalState({ cursor: { x: 10, y: 20 } });

    const state = awareness.getLocalState();
    expect(state.cursor.x).toBe(10);
  });

  it('should apply remote update', () => {
    awareness.applyUpdate('remote-user', { name: 'Remote' });

    const state = awareness.getState('remote-user');
    expect(state.name).toBe('Remote');
  });

  it('should not apply update from local user via applyUpdate', () => {
    awareness.setLocalState({ value: 1 });
    awareness.applyUpdate('local-user', { value: 100 });

    expect(awareness.getLocalState().value).toBe(1);
  });

  it('should get all states', () => {
    awareness.setLocalState({ a: 1 });
    awareness.applyUpdate('user-2', { b: 2 });

    const states = awareness.getStates();
    expect(states.size).toBe(2);
  });

  it('should notify on change', () => {
    const handler = vi.fn();
    awareness.onChange(handler);

    awareness.setLocalState({ updated: true });

    expect(handler).toHaveBeenCalled();
  });
});

describe('Room Manager Tests', () => {
  let rooms;

  beforeEach(() => {
    rooms = createRoomManager();
  });

  it('should create room', () => {
    const room = rooms.createRoom('room-1', { name: 'Test Room' });

    expect(room.id).toBe('room-1');
    expect(room.metadata.name).toBe('Test Room');
  });

  it('should get existing room', () => {
    rooms.createRoom('room-1');

    const room = rooms.getRoom('room-1');
    expect(room).not.toBeNull();
  });

  it('should join room', () => {
    rooms.joinRoom('room-1', 'user-1', { name: 'Alice' });

    const room = rooms.getRoom('room-1');
    expect(room.presence.isOnline('user-1')).toBe(true);
  });

  it('should leave room', () => {
    rooms.joinRoom('room-1', 'user-1');
    rooms.leaveRoom('room-1', 'user-1');

    const room = rooms.getRoom('room-1');
    expect(room.presence.isOnline('user-1')).toBe(false);
  });

  it('should delete room', () => {
    rooms.createRoom('room-1');
    rooms.deleteRoom('room-1');

    expect(rooms.getRoom('room-1')).toBeNull();
  });

  it('should list rooms', () => {
    rooms.createRoom('room-1');
    rooms.createRoom('room-2');

    expect(rooms.getRooms()).toContain('room-1');
    expect(rooms.getRooms()).toContain('room-2');
    expect(rooms.getRoomCount()).toBe(2);
  });
});
