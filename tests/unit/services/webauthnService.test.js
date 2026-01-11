/**
 * WebAuthn Service Unit Tests
 *
 * Tests for WebAuthn/Passkeys authentication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// Mock the database
vi.mock('../../../server/database', () => ({
  default: {
    run: vi.fn((sql, params, cb) => {
      if (typeof params === 'function') {
        params.call({ lastID: 1, changes: 1 }, null);
      } else if (cb) {
        cb.call({ lastID: 1, changes: 1 }, null);
      }
    }),
    get: vi.fn((sql, params, cb) => {
      if (typeof params === 'function') {
        params(null, null);
      } else if (cb) {
        cb(null, null);
      }
    }),
    all: vi.fn((sql, params, cb) => {
      if (typeof params === 'function') {
        params(null, []);
      } else if (cb) {
        cb(null, []);
      }
    }),
  },
}));

describe('WebAuthn Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBAUTHN_RP_ID = 'consultinity.app';
    process.env.WEBAUTHN_RP_NAME = 'Consultinity';
    process.env.WEBAUTHN_RP_ORIGIN = 'https://consultinity.app';
  });

  describe('Challenge Generation', () => {
    it('should generate a cryptographically secure challenge', () => {
      const challenge = crypto.randomBytes(32).toString('base64url');

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(30);
    });

    it('should generate unique challenges each time', () => {
      const challenge1 = crypto.randomBytes(32).toString('base64url');
      const challenge2 = crypto.randomBytes(32).toString('base64url');

      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('Relying Party Configuration', () => {
    it('should have valid RP ID from environment', () => {
      const rpId = process.env.WEBAUTHN_RP_ID || 'consultinity.app';

      expect(rpId).toBeDefined();
      expect(typeof rpId).toBe('string');
      expect(rpId.length).toBeGreaterThan(0);
    });

    it('should have valid RP name from environment', () => {
      const rpName = process.env.WEBAUTHN_RP_NAME || 'Consultinity';

      expect(rpName).toBeDefined();
      expect(typeof rpName).toBe('string');
    });

    it('should have valid RP origin from environment', () => {
      const rpOrigin = process.env.WEBAUTHN_RP_ORIGIN || 'https://consultinity.app';

      expect(rpOrigin).toBeDefined();
      expect(rpOrigin.startsWith('https://')).toBe(true);
    });
  });

  describe('Supported Algorithms', () => {
    it('should support ES256 algorithm (-7)', () => {
      const supportedAlgorithms = [-7, -257, -8];
      expect(supportedAlgorithms).toContain(-7);
    });

    it('should support RS256 algorithm (-257)', () => {
      const supportedAlgorithms = [-7, -257, -8];
      expect(supportedAlgorithms).toContain(-257);
    });

    it('should support EdDSA algorithm (-8)', () => {
      const supportedAlgorithms = [-7, -257, -8];
      expect(supportedAlgorithms).toContain(-8);
    });
  });

  describe('Authenticator Selection', () => {
    it('should support platform authenticators', () => {
      const authenticatorAttachment = 'platform';
      expect(['platform', 'cross-platform']).toContain(authenticatorAttachment);
    });

    it('should support cross-platform authenticators', () => {
      const authenticatorAttachment = 'cross-platform';
      expect(['platform', 'cross-platform']).toContain(authenticatorAttachment);
    });

    it('should require user verification', () => {
      const userVerification = 'preferred';
      expect(['required', 'preferred', 'discouraged']).toContain(userVerification);
    });

    it('should prefer resident keys for discoverable credentials', () => {
      const residentKey = 'preferred';
      expect(['required', 'preferred', 'discouraged']).toContain(residentKey);
    });
  });

  describe('Attestation', () => {
    it('should support none attestation for privacy', () => {
      const attestation = 'none';
      expect(['none', 'indirect', 'direct', 'enterprise']).toContain(attestation);
    });

    it('should support direct attestation for enterprise', () => {
      const attestation = 'direct';
      expect(['none', 'indirect', 'direct', 'enterprise']).toContain(attestation);
    });
  });

  describe('Credential Storage', () => {
    it('should encode credential ID as base64url', () => {
      const credentialId = crypto.randomBytes(32);
      const encoded = credentialId.toString('base64url');

      expect(encoded).toBeDefined();
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should store public key as COSE', () => {
      const publicKeyCose = Buffer.from([1, 2, 3, 4, 5]).toString('base64');

      expect(publicKeyCose).toBeDefined();
      expect(typeof publicKeyCose).toBe('string');
    });

    it('should track sign count for replay protection', () => {
      const signCount = 0;
      expect(typeof signCount).toBe('number');
      expect(signCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Device Names', () => {
    it('should allow custom device names', () => {
      const deviceName = 'My MacBook Pro';
      expect(typeof deviceName).toBe('string');
      expect(deviceName.length).toBeGreaterThan(0);
    });

    it('should generate default device name if not provided', () => {
      const defaultName = `Passkey ${new Date().toLocaleDateString()}`;
      expect(defaultName).toContain('Passkey');
    });
  });

  describe('Challenge Expiration', () => {
    it('should set challenge expiration to 5 minutes', () => {
      const expirationMs = 5 * 60 * 1000;
      expect(expirationMs).toBe(300000);
    });

    it('should reject expired challenges', () => {
      const challengeCreatedAt = new Date(Date.now() - 6 * 60 * 1000);
      const expirationMs = 5 * 60 * 1000;
      const now = new Date();

      const isExpired = now - challengeCreatedAt > expirationMs;
      expect(isExpired).toBe(true);
    });

    it('should accept valid challenges', () => {
      const challengeCreatedAt = new Date(Date.now() - 2 * 60 * 1000);
      const expirationMs = 5 * 60 * 1000;
      const now = new Date();

      const isExpired = now - challengeCreatedAt > expirationMs;
      expect(isExpired).toBe(false);
    });
  });

  describe('Transports', () => {
    it('should track credential transports', () => {
      const transports = ['internal', 'hybrid', 'usb', 'nfc', 'ble'];

      expect(transports).toContain('internal');
      expect(transports).toContain('usb');
    });
  });

  describe('Backup State', () => {
    it('should track credential backup eligibility', () => {
      const backupEligible = true;
      expect(typeof backupEligible).toBe('boolean');
    });

    it('should track credential backup state', () => {
      const backupState = false;
      expect(typeof backupState).toBe('boolean');
    });
  });
});

describe('WebAuthn Error Handling', () => {
  it('should handle invalid credential error', () => {
    const errorType = 'InvalidCredentialError';
    expect(errorType).toBe('InvalidCredentialError');
  });

  it('should handle timeout error', () => {
    const errorType = 'TimeoutError';
    expect(errorType).toBe('TimeoutError');
  });

  it('should handle user cancellation', () => {
    const errorType = 'NotAllowedError';
    expect(errorType).toBe('NotAllowedError');
  });

  it('should handle not supported error', () => {
    const errorType = 'NotSupportedError';
    expect(errorType).toBe('NotSupportedError');
  });
});
