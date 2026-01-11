/**
 * Token Service Tests
 * Tests for JWT and CSRF token management
 *
 * @module tests/tokens/token-service.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// JWT Service mock implementation
const createJWTService = (options = {}) => {
  const { secret = 'test-secret', expiresIn = '1h' } = options;
  const tokenStore = new Map();

  const parseExpiry = (expiry) => {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(match[1]) * units[match[2]];
  };

  return {
    sign: (payload, opts = {}) => {
      const now = Date.now();
      const exp = now + parseExpiry(opts.expiresIn || expiresIn);

      const header = { alg: 'HS256', typ: 'JWT' };
      const body = { ...payload, iat: now, exp };

      const base64Header = btoa(JSON.stringify(header));
      const base64Body = btoa(JSON.stringify(body));
      const signature = btoa(`${base64Header}.${base64Body}.${secret}`);

      return `${base64Header}.${base64Body}.${signature}`;
    },

    verify: (token) => {
      if (tokenStore.get(token) === 'revoked') {
        throw new Error('Token has been revoked');
      }

      try {
        const [headerB64, bodyB64, signatureB64] = token.split('.');

        // Verify signature
        const expectedSignature = btoa(`${headerB64}.${bodyB64}.${secret}`);
        if (signatureB64 !== expectedSignature) {
          throw new Error('Invalid signature');
        }

        const payload = JSON.parse(atob(bodyB64));

        // Check expiration
        if (payload.exp && payload.exp < Date.now()) {
          throw new Error('Token has expired');
        }

        return payload;
      } catch (error) {
        if (error.message.includes('expired') || error.message.includes('revoked')) {
          throw error;
        }
        throw new Error('Invalid token');
      }
    },

    decode: (token) => {
      try {
        const [, bodyB64] = token.split('.');
        return JSON.parse(atob(bodyB64));
      } catch {
        return null;
      }
    },

    refresh: (token, opts = {}) => {
      const payload = this.verify(token);
      const { iat, exp, ...rest } = payload;
      return this.sign(rest, opts);
    },

    revoke: (token) => {
      tokenStore.set(token, 'revoked');
    },

    isRevoked: (token) => {
      return tokenStore.get(token) === 'revoked';
    },
  };
};

// CSRF Token Service
const createCSRFService = () => {
  const tokens = new Map();
  const tokenExpiry = 3600000; // 1 hour

  const generateToken = () => {
    const array = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  return {
    generate: (sessionId) => {
      const token = generateToken();
      tokens.set(`${sessionId}:${token}`, {
        createdAt: Date.now(),
        used: false,
      });
      return token;
    },

    validate: (sessionId, token) => {
      const key = `${sessionId}:${token}`;
      const data = tokens.get(key);

      if (!data) return { valid: false, reason: 'Token not found' };
      if (data.used) return { valid: false, reason: 'Token already used' };
      if (Date.now() - data.createdAt > tokenExpiry) {
        tokens.delete(key);
        return { valid: false, reason: 'Token expired' };
      }

      return { valid: true };
    },

    consume: (sessionId, token) => {
      const result = this.validate(sessionId, token);
      if (result.valid) {
        tokens.get(`${sessionId}:${token}`).used = true;
      }
      return result;
    },

    invalidate: (sessionId, token) => {
      return tokens.delete(`${sessionId}:${token}`);
    },

    cleanup: () => {
      const now = Date.now();
      for (const [key, data] of tokens) {
        if (now - data.createdAt > tokenExpiry) {
          tokens.delete(key);
        }
      }
    },
  };
};

// API Key Service
const createAPIKeyService = () => {
  const keys = new Map();

  const generateKey = () => {
    const array = crypto.getRandomValues(new Uint8Array(32));
    return `sk_${Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  };

  return {
    create: (userId, options = {}) => {
      const { name = 'API Key', scopes = ['read'], expiresAt } = options;
      const key = generateKey();

      keys.set(key, {
        userId,
        name,
        scopes,
        createdAt: Date.now(),
        expiresAt,
        lastUsedAt: null,
        usageCount: 0,
      });

      return { key, metadata: keys.get(key) };
    },

    validate: (key) => {
      const data = keys.get(key);

      if (!data) return { valid: false, reason: 'Key not found' };
      if (data.expiresAt && Date.now() > data.expiresAt) {
        return { valid: false, reason: 'Key expired' };
      }

      return { valid: true, userId: data.userId, scopes: data.scopes };
    },

    use: (key) => {
      const data = keys.get(key);
      if (data) {
        data.lastUsedAt = Date.now();
        data.usageCount++;
      }
    },

    hasScope: (key, scope) => {
      const data = keys.get(key);
      return data?.scopes?.includes(scope) || false;
    },

    revoke: (key) => {
      return keys.delete(key);
    },

    listForUser: (userId) => {
      const result = [];
      for (const [key, data] of keys) {
        if (data.userId === userId) {
          result.push({ key: `${key.slice(0, 8)}...`, ...data });
        }
      }
      return result;
    },
  };
};

describe('Token Service Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // JWT SERVICE
  // ═══════════════════════════════════════════════════════════════════

  describe('JWT Service', () => {
    let jwtService;

    beforeEach(() => {
      jwtService = createJWTService();
    });

    describe('sign', () => {
      it('should create token', () => {
        const token = jwtService.sign({ userId: '123' });

        expect(token).toBeDefined();
        expect(token.split('.').length).toBe(3);
      });

      it('should include payload in token', () => {
        const token = jwtService.sign({ userId: '123', role: 'admin' });
        const decoded = jwtService.decode(token);

        expect(decoded.userId).toBe('123');
        expect(decoded.role).toBe('admin');
      });

      it('should include iat and exp', () => {
        const token = jwtService.sign({ userId: '123' });
        const decoded = jwtService.decode(token);

        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
      });
    });

    describe('verify', () => {
      it('should verify valid token', () => {
        const token = jwtService.sign({ userId: '123' });
        const payload = jwtService.verify(token);

        expect(payload.userId).toBe('123');
      });

      it('should throw for expired token', () => {
        vi.useFakeTimers();
        const token = jwtService.sign({ userId: '123' }, { expiresIn: '1s' });

        vi.advanceTimersByTime(2000);

        expect(() => jwtService.verify(token)).toThrow('expired');
        vi.useRealTimers();
      });

      it('should throw for invalid signature', () => {
        const token = jwtService.sign({ userId: '123' });
        const tampered = token.replace(/.$/, 'X');

        expect(() => jwtService.verify(tampered)).toThrow('Invalid');
      });

      it('should throw for revoked token', () => {
        const token = jwtService.sign({ userId: '123' });
        jwtService.revoke(token);

        expect(() => jwtService.verify(token)).toThrow('revoked');
      });
    });

    describe('decode', () => {
      it('should decode without verification', () => {
        const token = jwtService.sign({ userId: '123' });
        const decoded = jwtService.decode(token);

        expect(decoded.userId).toBe('123');
      });

      it('should return null for invalid token', () => {
        expect(jwtService.decode('invalid')).toBeNull();
      });
    });

    describe('refresh', () => {
      it('should refresh token', () => {
        const original = jwtService.sign({ userId: '123' });
        const refreshed = jwtService.refresh(original);

        expect(refreshed).not.toBe(original);

        const decoded = jwtService.decode(refreshed);
        expect(decoded.userId).toBe('123');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CSRF SERVICE
  // ═══════════════════════════════════════════════════════════════════

  describe('CSRF Service', () => {
    let csrfService;

    beforeEach(() => {
      csrfService = createCSRFService();
    });

    describe('generate', () => {
      it('should generate token', () => {
        const token = csrfService.generate('session-1');

        expect(token).toBeDefined();
        expect(token.length).toBe(64);
      });

      it('should generate unique tokens', () => {
        const token1 = csrfService.generate('session-1');
        const token2 = csrfService.generate('session-1');

        expect(token1).not.toBe(token2);
      });
    });

    describe('validate', () => {
      it('should validate correct token', () => {
        const token = csrfService.generate('session-1');
        const result = csrfService.validate('session-1', token);

        expect(result.valid).toBe(true);
      });

      it('should reject unknown token', () => {
        const result = csrfService.validate('session-1', 'unknown');

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('not found');
      });

      it('should reject token for wrong session', () => {
        const token = csrfService.generate('session-1');
        const result = csrfService.validate('session-2', token);

        expect(result.valid).toBe(false);
      });
    });

    describe('consume', () => {
      it('should consume token', () => {
        const token = csrfService.generate('session-1');

        const first = csrfService.consume('session-1', token);
        const second = csrfService.consume('session-1', token);

        expect(first.valid).toBe(true);
        expect(second.valid).toBe(false);
        expect(second.reason).toContain('already used');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // API KEY SERVICE
  // ═══════════════════════════════════════════════════════════════════

  describe('API Key Service', () => {
    let apiKeyService;

    beforeEach(() => {
      apiKeyService = createAPIKeyService();
    });

    describe('create', () => {
      it('should create API key', () => {
        const { key, metadata } = apiKeyService.create('user-1');

        expect(key).toMatch(/^sk_/);
        expect(metadata.userId).toBe('user-1');
      });

      it('should include scopes', () => {
        const { metadata } = apiKeyService.create('user-1', {
          scopes: ['read', 'write'],
        });

        expect(metadata.scopes).toContain('read');
        expect(metadata.scopes).toContain('write');
      });
    });

    describe('validate', () => {
      it('should validate key', () => {
        const { key } = apiKeyService.create('user-1');
        const result = apiKeyService.validate(key);

        expect(result.valid).toBe(true);
        expect(result.userId).toBe('user-1');
      });

      it('should reject unknown key', () => {
        const result = apiKeyService.validate('sk_unknown');

        expect(result.valid).toBe(false);
      });

      it('should reject expired key', () => {
        const { key } = apiKeyService.create('user-1', {
          expiresAt: Date.now() - 1000,
        });
        const result = apiKeyService.validate(key);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('expired');
      });
    });

    describe('hasScope', () => {
      it('should check scope', () => {
        const { key } = apiKeyService.create('user-1', {
          scopes: ['read'],
        });

        expect(apiKeyService.hasScope(key, 'read')).toBe(true);
        expect(apiKeyService.hasScope(key, 'write')).toBe(false);
      });
    });

    describe('revoke', () => {
      it('should revoke key', () => {
        const { key } = apiKeyService.create('user-1');
        apiKeyService.revoke(key);

        const result = apiKeyService.validate(key);
        expect(result.valid).toBe(false);
      });
    });

    describe('use', () => {
      it('should track usage', () => {
        const { key } = apiKeyService.create('user-1');

        apiKeyService.use(key);
        apiKeyService.use(key);

        const list = apiKeyService.listForUser('user-1');
        expect(list[0].usageCount).toBe(2);
      });
    });
  });
});
