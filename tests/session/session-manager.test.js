/**
 * Session Management Tests
 * Tests for session handling and storage
 * 
 * @module tests/session/session-manager.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Session manager implementation
const createSessionManager = (options = {}) => {
    const {
        maxAge = 3600000, // 1 hour
        maxSessions = 5,
        storage = new Map(),
    } = options;

    const generateId = () => {
        const array = crypto.getRandomValues(new Uint8Array(32));
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    };

    const userSessions = new Map(); // userId -> sessionId[]

    return {
        create: (userId, data = {}) => {
            const sessionId = generateId();
            const now = Date.now();

            const session = {
                id: sessionId,
                userId,
                data,
                createdAt: now,
                lastAccessedAt: now,
                expiresAt: now + maxAge,
                userAgent: data.userAgent || null,
                ipAddress: data.ipAddress || null,
            };

            storage.set(sessionId, session);

            // Track user sessions
            if (!userSessions.has(userId)) {
                userSessions.set(userId, []);
            }
            userSessions.get(userId).push(sessionId);

            // Enforce max sessions
            const sessions = userSessions.get(userId);
            while (sessions.length > maxSessions) {
                const oldestId = sessions.shift();
                storage.delete(oldestId);
            }

            return session;
        },

        get: (sessionId) => {
            const session = storage.get(sessionId);

            if (!session) return null;

            if (Date.now() > session.expiresAt) {
                this.destroy(sessionId);
                return null;
            }

            return session;
        },

        touch: (sessionId) => {
            const session = storage.get(sessionId);
            if (!session) return false;

            session.lastAccessedAt = Date.now();
            session.expiresAt = Date.now() + maxAge;
            return true;
        },

        update: (sessionId, data) => {
            const session = storage.get(sessionId);
            if (!session) return false;

            Object.assign(session.data, data);
            session.lastAccessedAt = Date.now();
            return true;
        },

        destroy: (sessionId) => {
            const session = storage.get(sessionId);
            if (!session) return false;

            // Remove from user sessions
            const sessions = userSessions.get(session.userId);
            if (sessions) {
                const index = sessions.indexOf(sessionId);
                if (index !== -1) sessions.splice(index, 1);
            }

            return storage.delete(sessionId);
        },

        destroyAllForUser: (userId) => {
            const sessions = userSessions.get(userId) || [];
            let count = 0;

            for (const sessionId of [...sessions]) {
                if (storage.delete(sessionId)) count++;
            }

            userSessions.delete(userId);
            return count;
        },

        getForUser: (userId) => {
            const sessionIds = userSessions.get(userId) || [];
            return sessionIds
                .map(id => storage.get(id))
                .filter(Boolean);
        },

        isValid: (sessionId) => {
            const session = this.get(sessionId);
            return session !== null;
        },

        cleanup: () => {
            const now = Date.now();
            let cleaned = 0;

            for (const [id, session] of storage) {
                if (now > session.expiresAt) {
                    this.destroy(id);
                    cleaned++;
                }
            }

            return cleaned;
        },

        getActiveCount: () => storage.size,

        extend: (sessionId, duration) => {
            const session = storage.get(sessionId);
            if (!session) return false;

            session.expiresAt += duration;
            return true;
        },
    };
};

describe('Session Manager Tests', () => {
    let sessionManager;

    beforeEach(() => {
        sessionManager = createSessionManager({ maxAge: 3600000, maxSessions: 3 });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════════════════

    describe('create', () => {
        it('should create session', () => {
            const session = sessionManager.create('user-1');

            expect(session.id).toBeDefined();
            expect(session.userId).toBe('user-1');
        });

        it('should include timestamps', () => {
            const session = sessionManager.create('user-1');

            expect(session.createdAt).toBeDefined();
            expect(session.lastAccessedAt).toBeDefined();
            expect(session.expiresAt).toBeDefined();
        });

        it('should include custom data', () => {
            const session = sessionManager.create('user-1', {
                role: 'admin',
                userAgent: 'Mozilla/5.0',
            });

            expect(session.data.role).toBe('admin');
            expect(session.userAgent).toBe('Mozilla/5.0');
        });

        it('should enforce max sessions', () => {
            sessionManager.create('user-1');
            sessionManager.create('user-1');
            sessionManager.create('user-1');
            const fourth = sessionManager.create('user-1');

            const sessions = sessionManager.getForUser('user-1');
            expect(sessions.length).toBe(3);
            expect(sessions.find(s => s.id === fourth.id)).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET
    // ═══════════════════════════════════════════════════════════════════

    describe('get', () => {
        it('should get session', () => {
            const created = sessionManager.create('user-1');
            const retrieved = sessionManager.get(created.id);

            expect(retrieved.id).toBe(created.id);
        });

        it('should return null for unknown session', () => {
            expect(sessionManager.get('unknown')).toBeNull();
        });

        it('should return null for expired session', () => {
            vi.useFakeTimers();
            const session = sessionManager.create('user-1');

            vi.advanceTimersByTime(4000000); // Past expiry

            expect(sessionManager.get(session.id)).toBeNull();
            vi.useRealTimers();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TOUCH
    // ═══════════════════════════════════════════════════════════════════

    describe('touch', () => {
        it('should update last accessed time', () => {
            vi.useFakeTimers();
            const session = sessionManager.create('user-1');
            const originalAccess = session.lastAccessedAt;

            vi.advanceTimersByTime(1000);
            sessionManager.touch(session.id);

            const updated = sessionManager.get(session.id);
            expect(updated.lastAccessedAt).toBeGreaterThan(originalAccess);
            vi.useRealTimers();
        });

        it('should extend expiry', () => {
            vi.useFakeTimers();
            const session = sessionManager.create('user-1');

            vi.advanceTimersByTime(1800000); // Half way
            sessionManager.touch(session.id);

            vi.advanceTimersByTime(1800000); // Another half
            expect(sessionManager.get(session.id)).not.toBeNull();
            vi.useRealTimers();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════════

    describe('update', () => {
        it('should update session data', () => {
            const session = sessionManager.create('user-1', { count: 1 });
            sessionManager.update(session.id, { count: 2, new: 'value' });

            const updated = sessionManager.get(session.id);
            expect(updated.data.count).toBe(2);
            expect(updated.data.new).toBe('value');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DESTROY
    // ═══════════════════════════════════════════════════════════════════

    describe('destroy', () => {
        it('should destroy session', () => {
            const session = sessionManager.create('user-1');
            sessionManager.destroy(session.id);

            expect(sessionManager.get(session.id)).toBeNull();
        });

        it('should remove from user sessions', () => {
            const session = sessionManager.create('user-1');
            sessionManager.destroy(session.id);

            expect(sessionManager.getForUser('user-1').length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DESTROY ALL FOR USER
    // ═══════════════════════════════════════════════════════════════════

    describe('destroyAllForUser', () => {
        it('should destroy all user sessions', () => {
            sessionManager.create('user-1');
            sessionManager.create('user-1');
            sessionManager.create('user-1');

            const count = sessionManager.destroyAllForUser('user-1');

            expect(count).toBe(3);
            expect(sessionManager.getForUser('user-1').length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET FOR USER
    // ═══════════════════════════════════════════════════════════════════

    describe('getForUser', () => {
        it('should get all user sessions', () => {
            sessionManager.create('user-1');
            sessionManager.create('user-1');
            sessionManager.create('user-2');

            const sessions = sessionManager.getForUser('user-1');

            expect(sessions.length).toBe(2);
            sessions.forEach(s => expect(s.userId).toBe('user-1'));
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // IS VALID
    // ═══════════════════════════════════════════════════════════════════

    describe('isValid', () => {
        it('should check session validity', () => {
            const session = sessionManager.create('user-1');

            expect(sessionManager.isValid(session.id)).toBe(true);
            expect(sessionManager.isValid('unknown')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════

    describe('cleanup', () => {
        it('should remove expired sessions', () => {
            vi.useFakeTimers();
            sessionManager.create('user-1');
            sessionManager.create('user-2');

            vi.advanceTimersByTime(4000000);
            const cleaned = sessionManager.cleanup();

            expect(cleaned).toBe(2);
            expect(sessionManager.getActiveCount()).toBe(0);
            vi.useRealTimers();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EXTEND
    // ═══════════════════════════════════════════════════════════════════

    describe('extend', () => {
        it('should extend session expiry', () => {
            const session = sessionManager.create('user-1');
            const originalExpiry = session.expiresAt;

            sessionManager.extend(session.id, 1000);

            const updated = sessionManager.get(session.id);
            expect(updated.expiresAt).toBe(originalExpiry + 1000);
        });
    });
});
