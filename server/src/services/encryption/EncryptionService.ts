/**
 * Encryption Service
 * Enterprise SaaS Architecture - Data Protection
 *
 * Provides field-level encryption for PII and sensitive data.
 *
 * Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Key derivation with PBKDF2
 * - Key rotation support
 * - Deterministic encryption for searchable fields
 * - Non-deterministic encryption for maximum security
 *
 * Security:
 * - Keys stored in environment variables (production: use Vault/KMS)
 * - Automatic key versioning for rotation
 * - Constant-time comparison for authentication tags
 */

import crypto from 'crypto';

import logger from '../../utils/Logger.js';

// ==========================================
// CONFIGURATION
// ==========================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits for AES-256
const PBKDF2_ITERATIONS = 100000;
const KEY_VERSION_LENGTH = 2; // 2 bytes for key version (allows 65535 versions)

// Encryption prefix to identify encrypted values
const ENCRYPTION_PREFIX = 'enc:v';

// ==========================================
// KEY MANAGEMENT
// ==========================================

interface EncryptionKey {
  version: number;
  key: Buffer;
  salt: Buffer;
  createdAt: Date;
  expiresAt: Date | null;
}

class KeyManager {
  private keys: Map<number, EncryptionKey> = new Map();
  private currentVersion: number = 1;

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize encryption keys from environment
   */
  private initializeKeys(): void {
    // Primary encryption key (required)
    const primaryKey = process.env.ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY;

    if (!primaryKey) {
      logger.warn('[Encryption] No ENCRYPTION_KEY set. Using development fallback key.');
      logger.warn('[Encryption] SET ENCRYPTION_KEY in production!');
    }

    const masterKey = primaryKey || this.generateDevelopmentKey();
    const salt = this.getSalt();

    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

    this.keys.set(1, {
      version: 1,
      key: derivedKey,
      salt,
      createdAt: new Date(),
      expiresAt: null,
    });

    // Load rotated keys if available
    this.loadRotatedKeys();
  }

  /**
   * Generate a development-only key (deterministic for dev consistency)
   */
  private generateDevelopmentKey(): string {
    return crypto
      .createHash('sha256')
      .update('consultinity-dev-encryption-key-do-not-use-in-production')
      .digest('hex');
  }

  /**
   * Get or create salt for key derivation
   */
  private getSalt(): Buffer {
    const saltEnv = process.env.ENCRYPTION_SALT;
    if (saltEnv) {
      return Buffer.from(saltEnv, 'hex');
    }

    // For development, use deterministic salt
    if (process.env.NODE_ENV !== 'production') {
      return crypto
        .createHash('sha256')
        .update('consultinity-dev-salt')
        .digest()
        .slice(0, SALT_LENGTH);
    }

    // Production requires explicit salt
    logger.error('[Encryption] ENCRYPTION_SALT required in production!');
    throw new Error('ENCRYPTION_SALT environment variable required in production');
  }

  /**
   * Load rotated keys from environment
   */
  private loadRotatedKeys(): void {
    // Support up to 10 rotated keys: ENCRYPTION_KEY_V2, ENCRYPTION_KEY_V3, etc.
    for (let v = 2; v <= 10; v++) {
      const keyEnv = process.env[`ENCRYPTION_KEY_V${v}`];
      if (keyEnv) {
        const salt = this.getSalt();
        const derivedKey = crypto.pbkdf2Sync(keyEnv, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

        this.keys.set(v, {
          version: v,
          key: derivedKey,
          salt,
          createdAt: new Date(),
          expiresAt: null,
        });

        this.currentVersion = Math.max(this.currentVersion, v);
      }
    }
  }

  /**
   * Get current encryption key
   */
  getCurrentKey(): EncryptionKey {
    const key = this.keys.get(this.currentVersion);
    if (!key) {
      throw new Error('No encryption key available');
    }
    return key;
  }

  /**
   * Get key by version (for decryption)
   */
  getKeyByVersion(version: number): EncryptionKey | undefined {
    return this.keys.get(version);
  }

  /**
   * Get current key version
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }
}

// Singleton key manager
const keyManager = new KeyManager();

// ==========================================
// ENCRYPTION SERVICE
// ==========================================

/**
 * Encrypt a value using AES-256-GCM
 * Returns: enc:vXX:iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  try {
    const key = keyManager.getCurrentKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const version = key.version.toString().padStart(KEY_VERSION_LENGTH, '0');

    return `${ENCRYPTION_PREFIX}${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  } catch (error) {
    logger.error('[Encryption] Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt a value encrypted with encrypt()
 */
export function decrypt(encrypted: string): string {
  if (!encrypted || !encrypted.startsWith(ENCRYPTION_PREFIX)) {
    return encrypted; // Not encrypted, return as-is
  }

  try {
    const parts = encrypted.slice(ENCRYPTION_PREFIX.length).split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted format');
    }

    let versionStr = parts[0];
    const ivHex = parts[1];
    const authTagHex = parts[2];
    const ciphertext = parts[3];

    // Handle deterministic encryption flag 'd'
    if (versionStr.startsWith('d')) {
      versionStr = versionStr.slice(1);
    }

    const version = parseInt(versionStr, 10);

    const key = keyManager.getKeyByVersion(version);
    if (!key) {
      throw new Error(`Encryption key version ${version} not found`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error: any) {
    if (error.message.includes('key version')) throw error;
    logger.error('[Encryption] Decryption failed:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Deterministic encryption for searchable fields
 * Uses HMAC-derived IV for same plaintext → same ciphertext
 * WARNING: Less secure than random IV - use only when search is required
 */
export function encryptDeterministic(plaintext: string): string {
  if (!plaintext) return plaintext;

  try {
    const key = keyManager.getCurrentKey();

    // Derive IV deterministically from plaintext using HMAC
    const ivKey = crypto.createHmac('sha256', key.key).update('iv-derivation').digest();
    const iv = crypto.createHmac('sha256', ivKey).update(plaintext).digest().slice(0, IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const version = key.version.toString().padStart(KEY_VERSION_LENGTH, '0');

    return `${ENCRYPTION_PREFIX}d${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  } catch (error) {
    logger.error('[Encryption] Deterministic encryption failed:', error);
    throw new Error('Deterministic encryption failed');
  }
}

/**
 * Hash a value for blind indexing (one-way, for searching)
 */
export function hashForIndex(value: string): string {
  if (!value) return value;

  const key = keyManager.getCurrentKey();
  return crypto.createHmac('sha256', key.key).update(value.toLowerCase().trim()).digest('hex');
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENCRYPTION_PREFIX) || false;
}

/**
 * Re-encrypt a value with the current key version
 * Used during key rotation
 */
export function reencrypt(encrypted: string): string {
  if (!isEncrypted(encrypted)) {
    return encrypt(encrypted);
  }

  const plaintext = decrypt(encrypted);
  return encrypt(plaintext);
}

// ==========================================
// PII FIELD ENCRYPTION
// ==========================================

/**
 * PII fields that should be encrypted
 */
export const PII_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'mobile',
  'address',
  'street',
  'city',
  'postalCode',
  'zipCode',
  'ssn',
  'pesel',
  'nip',
  'taxId',
  'bankAccount',
  'iban',
  'creditCard',
  'dateOfBirth',
  'birthDate',
] as const;

/**
 * Fields that need deterministic encryption (for searching)
 */
export const SEARCHABLE_PII_FIELDS = [
  'email', // Often used for login/lookup
] as const;

type PIIField = (typeof PII_FIELDS)[number];
type SearchablePIIField = (typeof SEARCHABLE_PII_FIELDS)[number];

/**
 * Encrypt PII fields in an object
 */
export function encryptPII<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const result = { ...obj };

  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === 'string') {
      const value = result[field] as string;
      if (!isEncrypted(value)) {
        // Use deterministic encryption for searchable fields
        if ((SEARCHABLE_PII_FIELDS as readonly string[]).includes(field)) {
          result[field as keyof T] = encryptDeterministic(value) as T[keyof T];
        } else {
          result[field as keyof T] = encrypt(value) as T[keyof T];
        }
      }
    }
  }

  return result;
}

/**
 * Decrypt PII fields in an object
 */
export function decryptPII<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const result = { ...obj };

  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === 'string') {
      const value = result[field] as string;
      if (isEncrypted(value)) {
        result[field as keyof T] = decrypt(value) as T[keyof T];
      }
    }
  }

  return result;
}

// ==========================================
// FILE ENCRYPTION
// ==========================================

/**
 * Encrypt a file buffer
 */
export function encryptBuffer(buffer: Buffer): Buffer {
  const key = keyManager.getCurrentKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key.key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = cipher.getAuthTag();
  const version = Buffer.alloc(KEY_VERSION_LENGTH);
  version.writeUInt16BE(key.version);

  // Format: version(2) + iv(16) + authTag(16) + ciphertext
  return Buffer.concat([version, iv, authTag, ciphertext]);
}

/**
 * Decrypt a file buffer
 */
export function decryptBuffer(encrypted: Buffer): Buffer {
  const version = encrypted.readUInt16BE(0);
  const iv = encrypted.slice(KEY_VERSION_LENGTH, KEY_VERSION_LENGTH + IV_LENGTH);
  const authTag = encrypted.slice(
    KEY_VERSION_LENGTH + IV_LENGTH,
    KEY_VERSION_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = encrypted.slice(KEY_VERSION_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = keyManager.getKeyByVersion(version);
  if (!key) {
    throw new Error(`Encryption key version ${version} not found`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key.key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ==========================================
// KEY ROTATION UTILITIES
// ==========================================

/**
 * Get current key version (for monitoring)
 */
export function getCurrentKeyVersion(): number {
  return keyManager.getCurrentVersion();
}

/**
 * Check if data needs re-encryption (uses old key)
 */
export function needsReencryption(encrypted: string): boolean {
  if (!isEncrypted(encrypted)) return false;

  const versionStr = encrypted.slice(
    ENCRYPTION_PREFIX.length,
    ENCRYPTION_PREFIX.length + KEY_VERSION_LENGTH
  );
  const version = parseInt(versionStr, 10);

  return version < keyManager.getCurrentVersion();
}

// ==========================================
// EXPORTS
// ==========================================

export const EncryptionService = {
  // Core encryption
  encrypt,
  decrypt,
  encryptDeterministic,
  hashForIndex,
  isEncrypted,
  reencrypt,

  // PII encryption
  encryptPII,
  decryptPII,
  PII_FIELDS,
  SEARCHABLE_PII_FIELDS,

  // File encryption
  encryptBuffer,
  decryptBuffer,

  // Key management
  getCurrentKeyVersion,
  needsReencryption,
};

export default EncryptionService;
