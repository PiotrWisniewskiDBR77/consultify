/**
 * Biometric Authentication Tests
 * Tests for biometric auth patterns
 *
 * @module tests/auth/biometric.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Biometric authenticator implementation
const createBiometricAuth = (options = {}) => {
  const { timeout = 30000 } = options;
  let isAvailable = true;
  let registeredCredentials = new Map();
  const challenges = new Map();

  // Simulate WebAuthn Credential types
  const supportedTypes = ['fingerprint', 'face', 'voice', 'iris'];

  return {
    // Check if biometric auth is available
    isSupported: async () => {
      // In real implementation: navigator.credentials && PublicKeyCredential
      return isAvailable;
    },

    getSupportedTypes: async () => {
      return supportedTypes.filter((type) => isAvailable);
    },

    // Generate registration challenge
    generateChallenge: () => {
      const challenge = crypto.randomUUID();
      const expiry = Date.now() + timeout;
      challenges.set(challenge, { expiry, used: false });
      return challenge;
    },

    // Verify challenge is valid
    verifyChallenge: (challenge) => {
      const stored = challenges.get(challenge);
      if (!stored) return { valid: false, reason: 'INVALID_CHALLENGE' };
      if (stored.used) return { valid: false, reason: 'CHALLENGE_USED' };
      if (Date.now() > stored.expiry) return { valid: false, reason: 'CHALLENGE_EXPIRED' };

      challenges.set(challenge, { ...stored, used: true });
      return { valid: true };
    },

    // Register biometric credential
    register: async (userId, biometricType, options = {}) => {
      const challenge = this.generateChallenge?.() || crypto.randomUUID();

      // Simulate credential creation
      const credential = {
        id: crypto.randomUUID(),
        type: biometricType,
        userId,
        publicKey: `mock-public-key-${Date.now()}`,
        createdAt: Date.now(),
        attestation: options.attestation || 'none',
        userVerification: options.userVerification || 'preferred',
      };

      const userCreds = registeredCredentials.get(userId) || [];
      userCreds.push(credential);
      registeredCredentials.set(userId, userCreds);

      return {
        success: true,
        credentialId: credential.id,
        type: biometricType,
      };
    },

    // Authenticate with biometric
    authenticate: async (userId, credentialId) => {
      const userCreds = registeredCredentials.get(userId);

      if (!userCreds || userCreds.length === 0) {
        return { success: false, error: 'NO_CREDENTIALS' };
      }

      const credential = userCreds.find((c) => c.id === credentialId);

      if (!credential) {
        return { success: false, error: 'CREDENTIAL_NOT_FOUND' };
      }

      // Simulate biometric verification
      return {
        success: true,
        credentialId: credential.id,
        type: credential.type,
        authenticatedAt: Date.now(),
      };
    },

    // List registered credentials for user
    getCredentials: (userId) => {
      const creds = registeredCredentials.get(userId) || [];
      return creds.map((c) => ({
        id: c.id,
        type: c.type,
        createdAt: c.createdAt,
      }));
    },

    // Remove credential
    removeCredential: (userId, credentialId) => {
      const userCreds = registeredCredentials.get(userId) || [];
      const filtered = userCreds.filter((c) => c.id !== credentialId);
      registeredCredentials.set(userId, filtered);
      return { success: true };
    },

    // For testing
    _setAvailable: (available) => {
      isAvailable = available;
    },

    _clearAll: () => {
      registeredCredentials.clear();
      challenges.clear();
    },
  };
};

// Platform authenticator detection
const createPlatformAuthenticator = () => {
  let platformAvailable = true;
  let crossPlatformAvailable = true;

  return {
    isPlatformAuthenticatorAvailable: async () => platformAvailable,

    isConditionalMediationAvailable: async () => true,

    getTransports: () => {
      const transports = [];
      if (platformAvailable) transports.push('internal');
      if (crossPlatformAvailable) transports.push('usb', 'nfc', 'ble');
      return transports;
    },

    // For testing
    _setPlatformAvailable: (available) => {
      platformAvailable = available;
    },
    _setCrossPlatformAvailable: (available) => {
      crossPlatformAvailable = available;
    },
  };
};

// Passkey manager (WebAuthn credential management)
const createPasskeyManager = (biometricAuth) => {
  const discoverable = new Map(); // Resident credentials

  return {
    createPasskey: async (userId, userDisplayName, options = {}) => {
      const result = await biometricAuth.register(userId, 'passkey', {
        ...options,
        residentKey: 'required',
        userVerification: 'required',
      });

      if (result.success) {
        discoverable.set(result.credentialId, {
          userId,
          userDisplayName,
          createdAt: Date.now(),
        });
      }

      return result;
    },

    authenticateWithPasskey: async (credentialId) => {
      const passkey = discoverable.get(credentialId);

      if (!passkey) {
        return { success: false, error: 'PASSKEY_NOT_FOUND' };
      }

      const result = await biometricAuth.authenticate(passkey.userId, credentialId);

      if (result.success) {
        return {
          ...result,
          userId: passkey.userId,
          userDisplayName: passkey.userDisplayName,
        };
      }

      return result;
    },

    getDiscoverablePasskeys: () => {
      return [...discoverable.entries()].map(([id, data]) => ({
        credentialId: id,
        ...data,
      }));
    },

    deletePasskey: (credentialId) => {
      const passkey = discoverable.get(credentialId);
      if (passkey) {
        biometricAuth.removeCredential(passkey.userId, credentialId);
        discoverable.delete(credentialId);
        return { success: true };
      }
      return { success: false, error: 'NOT_FOUND' };
    },
  };
};

// Liveness detection (anti-spoofing)
const createLivenessDetector = () => {
  const challenges = ['blink', 'smile', 'turn_left', 'turn_right', 'nod'];

  return {
    generateChallenge: () => {
      const randomIndex = Math.floor(Math.random() * challenges.length);
      return {
        id: crypto.randomUUID(),
        action: challenges[randomIndex],
        expiresAt: Date.now() + 30000,
      };
    },

    verify: async (challengeId, response) => {
      // Simulate liveness check
      if (!response.actionCompleted) {
        return { success: false, reason: 'ACTION_NOT_COMPLETED' };
      }

      if (response.confidence < 0.8) {
        return { success: false, reason: 'LOW_CONFIDENCE' };
      }

      return {
        success: true,
        confidence: response.confidence,
        spoofingDetected: false,
      };
    },

    getChallengeTypes: () => [...challenges],
  };
};

describe('Biometric Authentication Tests', () => {
  let biometricAuth;

  beforeEach(() => {
    biometricAuth = createBiometricAuth();
    biometricAuth._clearAll();
  });

  // ═══════════════════════════════════════════════════════════════════
  // AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════

  describe('availability', () => {
    it('should check if supported', async () => {
      expect(await biometricAuth.isSupported()).toBe(true);
    });

    it('should handle unavailable', async () => {
      biometricAuth._setAvailable(false);
      expect(await biometricAuth.isSupported()).toBe(false);
    });

    it('should list supported types', async () => {
      const types = await biometricAuth.getSupportedTypes();
      expect(types).toContain('fingerprint');
      expect(types).toContain('face');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ═══════════════════════════════════════════════════════════════════

  describe('registration', () => {
    it('should register biometric credential', async () => {
      const result = await biometricAuth.register('user-1', 'fingerprint');

      expect(result.success).toBe(true);
      expect(result.credentialId).toBeTruthy();
      expect(result.type).toBe('fingerprint');
    });

    it('should list user credentials', async () => {
      await biometricAuth.register('user-1', 'fingerprint');
      await biometricAuth.register('user-1', 'face');

      const creds = biometricAuth.getCredentials('user-1');
      expect(creds.length).toBe(2);
    });

    it('should remove credential', async () => {
      const result = await biometricAuth.register('user-1', 'fingerprint');
      biometricAuth.removeCredential('user-1', result.credentialId);

      const creds = biometricAuth.getCredentials('user-1');
      expect(creds.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════

  describe('authentication', () => {
    it('should authenticate with valid credential', async () => {
      const reg = await biometricAuth.register('user-1', 'fingerprint');
      const auth = await biometricAuth.authenticate('user-1', reg.credentialId);

      expect(auth.success).toBe(true);
      expect(auth.type).toBe('fingerprint');
    });

    it('should fail for unknown user', async () => {
      const result = await biometricAuth.authenticate('unknown', 'cred-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_CREDENTIALS');
    });

    it('should fail for wrong credential', async () => {
      await biometricAuth.register('user-1', 'fingerprint');
      const result = await biometricAuth.authenticate('user-1', 'wrong-cred');

      expect(result.success).toBe(false);
      expect(result.error).toBe('CREDENTIAL_NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CHALLENGE
  // ═══════════════════════════════════════════════════════════════════

  describe('challenge', () => {
    it('should generate challenge', () => {
      const challenge = biometricAuth.generateChallenge();
      expect(challenge).toBeTruthy();
    });

    it('should verify valid challenge', () => {
      const challenge = biometricAuth.generateChallenge();
      const result = biometricAuth.verifyChallenge(challenge);

      expect(result.valid).toBe(true);
    });

    it('should reject used challenge', () => {
      const challenge = biometricAuth.generateChallenge();
      biometricAuth.verifyChallenge(challenge);
      const result = biometricAuth.verifyChallenge(challenge);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('CHALLENGE_USED');
    });

    it('should reject invalid challenge', () => {
      const result = biometricAuth.verifyChallenge('invalid-challenge');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CHALLENGE');
    });
  });
});

describe('Platform Authenticator Tests', () => {
  let platformAuth;

  beforeEach(() => {
    platformAuth = createPlatformAuthenticator();
  });

  it('should detect platform authenticator', async () => {
    expect(await platformAuth.isPlatformAuthenticatorAvailable()).toBe(true);
  });

  it('should get available transports', () => {
    const transports = platformAuth.getTransports();
    expect(transports).toContain('internal');
  });

  it('should handle platform not available', async () => {
    platformAuth._setPlatformAvailable(false);
    expect(await platformAuth.isPlatformAuthenticatorAvailable()).toBe(false);
  });
});

describe('Passkey Manager Tests', () => {
  let biometricAuth;
  let passkeyManager;

  beforeEach(() => {
    biometricAuth = createBiometricAuth();
    biometricAuth._clearAll();
    passkeyManager = createPasskeyManager(biometricAuth);
  });

  it('should create passkey', async () => {
    const result = await passkeyManager.createPasskey('user-1', 'John Doe');

    expect(result.success).toBe(true);
    expect(result.credentialId).toBeTruthy();
  });

  it('should authenticate with passkey', async () => {
    const created = await passkeyManager.createPasskey('user-1', 'John Doe');
    const auth = await passkeyManager.authenticateWithPasskey(created.credentialId);

    expect(auth.success).toBe(true);
    expect(auth.userId).toBe('user-1');
    expect(auth.userDisplayName).toBe('John Doe');
  });

  it('should list discoverable passkeys', async () => {
    await passkeyManager.createPasskey('user-1', 'John');
    await passkeyManager.createPasskey('user-2', 'Jane');

    const passkeys = passkeyManager.getDiscoverablePasskeys();
    expect(passkeys.length).toBe(2);
  });

  it('should delete passkey', async () => {
    const created = await passkeyManager.createPasskey('user-1', 'John');
    const result = passkeyManager.deletePasskey(created.credentialId);

    expect(result.success).toBe(true);
    expect(passkeyManager.getDiscoverablePasskeys().length).toBe(0);
  });
});

describe('Liveness Detection Tests', () => {
  let detector;

  beforeEach(() => {
    detector = createLivenessDetector();
  });

  it('should generate challenge', () => {
    const challenge = detector.generateChallenge();

    expect(challenge.id).toBeTruthy();
    expect(challenge.action).toBeTruthy();
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should verify successful action', async () => {
    const challenge = detector.generateChallenge();
    const result = await detector.verify(challenge.id, {
      actionCompleted: true,
      confidence: 0.95,
    });

    expect(result.success).toBe(true);
    expect(result.spoofingDetected).toBe(false);
  });

  it('should reject incomplete action', async () => {
    const challenge = detector.generateChallenge();
    const result = await detector.verify(challenge.id, {
      actionCompleted: false,
      confidence: 0.9,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('ACTION_NOT_COMPLETED');
  });

  it('should reject low confidence', async () => {
    const challenge = detector.generateChallenge();
    const result = await detector.verify(challenge.id, {
      actionCompleted: true,
      confidence: 0.5,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('LOW_CONFIDENCE');
  });

  it('should list challenge types', () => {
    const types = detector.getChallengeTypes();
    expect(types).toContain('blink');
    expect(types).toContain('smile');
  });
});
