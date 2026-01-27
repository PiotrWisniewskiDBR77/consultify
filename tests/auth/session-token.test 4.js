/**
 * Session and Token Management Tests
 * Tests for session handling and token lifecycle
 *
 * @module tests/auth/session-token.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Session manager implementation
const createSessionManager = (options = {}) => {
  const {
    maxSessions = 5,
    sessionTimeout = 3600000, // 1 hour
    slidingWindow = true,
  } = options;

  const sessions = new Map();
  const userSessions = new Map(); // userId -> Set of sessionIds

  const generateSessionId = () => crypto.randomUUID();

  return {
    create: (userId, metadata = {}) => {
      const sessionId = generateSessionId();
      const now = Date.now();

      const session = {
        id: sessionId,
        userId,
        createdAt: now,
        lastActivityAt: now,
        expiresAt: now + sessionTimeout,
        metadata,
        isActive: true,
      };

      sessions.set(sessionId, session);

      // Track user sessions
      if (!userSessions.has(userId)) {
        userSessions.set(userId, new Set());
      }
      const userSessionSet = userSessions.get(userId);
      userSessionSet.add(sessionId);

      // Enforce max sessions
      if (userSessionSet.size > maxSessions) {
        const oldestId = [...userSessionSet][0];
        this.destroy(oldestId);
      }

      return { sessionId, session };
    },

    get: (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) return null;

      // Check expiration
      if (Date.now() > session.expiresAt) {
        this.destroy(sessionId);
        return null;
      }

      return { ...session };
    },

    validate: (sessionId) => {
      const session = this.get(sessionId);

      if (!session) {
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      if (!session.isActive) {
        return { valid: false, reason: 'SESSION_INACTIVE' };
      }

      if (Date.now() > session.expiresAt) {
        return { valid: false, reason: 'SESSION_EXPIRED' };
      }

      return { valid: true, session };
    },

    touch: (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) return false;

      session.lastActivityAt = Date.now();

      if (slidingWindow) {
        session.expiresAt = Date.now() + sessionTimeout;
      }

      return true;
    },

    destroy: (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) return false;

      sessions.delete(sessionId);

      const userSessionSet = userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
      }

      return true;
    },

    destroyAllForUser: (userId) => {
      const userSessionSet = userSessions.get(userId);
      if (!userSessionSet) return 0;

      const count = userSessionSet.size;
      for (const sessionId of userSessionSet) {
        sessions.delete(sessionId);
      }
      userSessions.delete(userId);

      return count;
    },

    getActiveSessions: (userId) => {
      const userSessionSet = userSessions.get(userId);
      if (!userSessionSet) return [];

      return [...userSessionSet]
        .map((id) => sessions.get(id))
        .filter((s) => s && s.isActive && Date.now() <= s.expiresAt);
    },

    getSessionCount: (userId) => {
      return this.getActiveSessions(userId).length;
    },
  };
};

// Token manager (JWT-like)
const createTokenManager = (options = {}) => {
  const {
    accessTokenTTL = 900000, // 15 min
    refreshTokenTTL = 604800000, // 7 days
    secret = 'test-secret',
  } = options;

  const refreshTokens = new Map();
  const revokedTokens = new Set();

  // Simple mock encoding (NOT real JWT)
  const encode = (payload) => {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  };

  const decode = (token) => {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return null;
    }
  };

  return {
    generateAccessToken: (userId, claims = {}) => {
      const now = Date.now();
      const payload = {
        type: 'access',
        sub: userId,
        iat: now,
        exp: now + accessTokenTTL,
        ...claims,
      };

      return {
        token: encode(payload),
        expiresAt: payload.exp,
      };
    },

    generateRefreshToken: (userId, sessionId) => {
      const now = Date.now();
      const tokenId = crypto.randomUUID();

      const payload = {
        type: 'refresh',
        jti: tokenId,
        sub: userId,
        sid: sessionId,
        iat: now,
        exp: now + refreshTokenTTL,
      };

      const token = encode(payload);
      refreshTokens.set(tokenId, { userId, sessionId, expiresAt: payload.exp });

      return {
        token,
        tokenId,
        expiresAt: payload.exp,
      };
    },

    verifyAccessToken: (token) => {
      if (revokedTokens.has(token)) {
        return { valid: false, reason: 'TOKEN_REVOKED' };
      }

      const payload = decode(token);
      if (!payload) {
        return { valid: false, reason: 'INVALID_TOKEN' };
      }

      if (payload.type !== 'access') {
        return { valid: false, reason: 'WRONG_TOKEN_TYPE' };
      }

      if (Date.now() > payload.exp) {
        return { valid: false, reason: 'TOKEN_EXPIRED' };
      }

      return { valid: true, payload };
    },

    verifyRefreshToken: (token) => {
      const payload = decode(token);
      if (!payload) {
        return { valid: false, reason: 'INVALID_TOKEN' };
      }

      if (payload.type !== 'refresh') {
        return { valid: false, reason: 'WRONG_TOKEN_TYPE' };
      }

      if (!refreshTokens.has(payload.jti)) {
        return { valid: false, reason: 'TOKEN_REVOKED' };
      }

      if (Date.now() > payload.exp) {
        refreshTokens.delete(payload.jti);
        return { valid: false, reason: 'TOKEN_EXPIRED' };
      }

      return { valid: true, payload };
    },

    refresh: (refreshToken) => {
      const verification = this.verifyRefreshToken(refreshToken);
      if (!verification.valid) {
        return { success: false, error: verification.reason };
      }

      const { payload } = verification;

      // Rotate refresh token
      refreshTokens.delete(payload.jti);

      const newAccess = this.generateAccessToken(payload.sub);
      const newRefresh = this.generateRefreshToken(payload.sub, payload.sid);

      return {
        success: true,
        accessToken: newAccess.token,
        refreshToken: newRefresh.token,
      };
    },

    revokeAccessToken: (token) => {
      revokedTokens.add(token);
    },

    revokeRefreshToken: (tokenId) => {
      return refreshTokens.delete(tokenId);
    },

    revokeAllForUser: (userId) => {
      let count = 0;
      for (const [id, data] of refreshTokens) {
        if (data.userId === userId) {
          refreshTokens.delete(id);
          count++;
        }
      }
      return count;
    },
  };
};

// Token rotation with family tracking
const createTokenRotationManager = () => {
  const families = new Map(); // familyId -> { tokens: Set, userId }

  return {
    createFamily: (userId) => {
      const familyId = crypto.randomUUID();
      families.set(familyId, { userId, tokens: new Set(), createdAt: Date.now() });
      return familyId;
    },

    addToken: (familyId, tokenId) => {
      const family = families.get(familyId);
      if (!family) return false;
      family.tokens.add(tokenId);
      return true;
    },

    isTokenInFamily: (familyId, tokenId) => {
      const family = families.get(familyId);
      return family?.tokens.has(tokenId) ?? false;
    },

    revokeFamily: (familyId) => {
      const family = families.get(familyId);
      if (!family) return { success: false };

      const count = family.tokens.size;
      families.delete(familyId);
      return { success: true, revokedCount: count };
    },

    detectReuse: (familyId, tokenId) => {
      const family = families.get(familyId);
      if (!family) return { reuse: false, familyExists: false };

      if (family.tokens.has(tokenId)) {
        // Token already used - potential theft
        return { reuse: true, familyExists: true };
      }

      return { reuse: false, familyExists: true };
    },

    getFamilyInfo: (familyId) => {
      const family = families.get(familyId);
      if (!family) return null;

      return {
        userId: family.userId,
        tokenCount: family.tokens.size,
        createdAt: family.createdAt,
      };
    },
  };
};

describe('Session Manager Tests', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = createSessionManager({ maxSessions: 3 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SESSION CREATION
  // ═══════════════════════════════════════════════════════════════════

  describe('session creation', () => {
    it('should create session', () => {
      const { sessionId, session } = sessionManager.create('user-1');

      expect(sessionId).toBeTruthy();
      expect(session.userId).toBe('user-1');
      expect(session.isActive).toBe(true);
    });

    it('should store metadata', () => {
      const { session } = sessionManager.create('user-1', { device: 'mobile' });

      expect(session.metadata.device).toBe('mobile');
    });

    it('should enforce max sessions', () => {
      sessionManager.create('user-1');
      sessionManager.create('user-1');
      sessionManager.create('user-1');
      sessionManager.create('user-1'); // Should remove oldest

      expect(sessionManager.getSessionCount('user-1')).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SESSION VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('session validation', () => {
    it('should validate active session', () => {
      const { sessionId } = sessionManager.create('user-1');
      const result = sessionManager.validate(sessionId);

      expect(result.valid).toBe(true);
    });

    it('should reject unknown session', () => {
      const result = sessionManager.validate('unknown-id');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SESSION DESTRUCTION
  // ═══════════════════════════════════════════════════════════════════

  describe('session destruction', () => {
    it('should destroy session', () => {
      const { sessionId } = sessionManager.create('user-1');
      const result = sessionManager.destroy(sessionId);

      expect(result).toBe(true);
      expect(sessionManager.get(sessionId)).toBeNull();
    });

    it('should destroy all user sessions', () => {
      sessionManager.create('user-1');
      sessionManager.create('user-1');

      const count = sessionManager.destroyAllForUser('user-1');

      expect(count).toBe(2);
      expect(sessionManager.getSessionCount('user-1')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SESSION ACTIVITY
  // ═══════════════════════════════════════════════════════════════════

  describe('session activity', () => {
    it('should touch session', () => {
      const { sessionId, session: originalSession } = sessionManager.create('user-1');

      // Wait a bit
      vi.advanceTimersByTime?.(1000) || new Promise((r) => setTimeout(r, 10));

      sessionManager.touch(sessionId);
      const session = sessionManager.get(sessionId);

      expect(session.lastActivityAt).toBeGreaterThanOrEqual(originalSession.lastActivityAt);
    });

    it('should list active sessions', () => {
      sessionManager.create('user-1', { device: 'desktop' });
      sessionManager.create('user-1', { device: 'mobile' });

      const sessions = sessionManager.getActiveSessions('user-1');

      expect(sessions.length).toBe(2);
    });
  });
});

describe('Token Manager Tests', () => {
  let tokenManager;

  beforeEach(() => {
    tokenManager = createTokenManager();
  });

  // ═══════════════════════════════════════════════════════════════════
  // ACCESS TOKENS
  // ═══════════════════════════════════════════════════════════════════

  describe('access tokens', () => {
    it('should generate access token', () => {
      const { token, expiresAt } = tokenManager.generateAccessToken('user-1');

      expect(token).toBeTruthy();
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it('should verify valid token', () => {
      const { token } = tokenManager.generateAccessToken('user-1');
      const result = tokenManager.verifyAccessToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload.sub).toBe('user-1');
    });

    it('should include custom claims', () => {
      const { token } = tokenManager.generateAccessToken('user-1', { role: 'admin' });
      const { payload } = tokenManager.verifyAccessToken(token);

      expect(payload.role).toBe('admin');
    });

    it('should reject revoked token', () => {
      const { token } = tokenManager.generateAccessToken('user-1');
      tokenManager.revokeAccessToken(token);

      const result = tokenManager.verifyAccessToken(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_REVOKED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REFRESH TOKENS
  // ═══════════════════════════════════════════════════════════════════

  describe('refresh tokens', () => {
    it('should generate refresh token', () => {
      const { token, tokenId } = tokenManager.generateRefreshToken('user-1', 'session-1');

      expect(token).toBeTruthy();
      expect(tokenId).toBeTruthy();
    });

    it('should verify refresh token', () => {
      const { token } = tokenManager.generateRefreshToken('user-1', 'session-1');
      const result = tokenManager.verifyRefreshToken(token);

      expect(result.valid).toBe(true);
    });

    it('should refresh tokens', () => {
      const { token } = tokenManager.generateRefreshToken('user-1', 'session-1');
      const result = tokenManager.refresh(token);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should rotate refresh token on use', () => {
      const { token } = tokenManager.generateRefreshToken('user-1', 'session-1');
      tokenManager.refresh(token);

      // Old token should no longer work
      const result = tokenManager.refresh(token);
      expect(result.success).toBe(false);
    });
  });
});

describe('Token Rotation Manager Tests', () => {
  let rotationManager;

  beforeEach(() => {
    rotationManager = createTokenRotationManager();
  });

  it('should create token family', () => {
    const familyId = rotationManager.createFamily('user-1');
    expect(familyId).toBeTruthy();
  });

  it('should add token to family', () => {
    const familyId = rotationManager.createFamily('user-1');
    const result = rotationManager.addToken(familyId, 'token-1');

    expect(result).toBe(true);
    expect(rotationManager.isTokenInFamily(familyId, 'token-1')).toBe(true);
  });

  it('should detect token reuse', () => {
    const familyId = rotationManager.createFamily('user-1');
    rotationManager.addToken(familyId, 'token-1');

    const result = rotationManager.detectReuse(familyId, 'token-1');

    expect(result.reuse).toBe(true);
  });

  it('should revoke entire family', () => {
    const familyId = rotationManager.createFamily('user-1');
    rotationManager.addToken(familyId, 'token-1');
    rotationManager.addToken(familyId, 'token-2');

    const result = rotationManager.revokeFamily(familyId);

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(2);
  });

  it('should get family info', () => {
    const familyId = rotationManager.createFamily('user-1');
    rotationManager.addToken(familyId, 'token-1');

    const info = rotationManager.getFamilyInfo(familyId);

    expect(info.userId).toBe('user-1');
    expect(info.tokenCount).toBe(1);
  });
});
