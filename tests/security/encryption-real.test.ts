/**
 * Real Encryption Security Tests (P0)
 *
 * Tests the ACTUAL EncryptionService.ts implementation.
 * Verifies:
 * - AES-256-GCM authenticated encryption (random IV)
 * - Deterministic encryption for searchable fields
 * - PII object encryption/decryption
 * - Key versioning and integrity tags
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { EncryptionService } from '../../server/src/services/encryption/EncryptionService';

describe('Real Encryption Security (P0)', () => {
  // Ensure environment variables are set for tests if needed
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long-12345';
    process.env.ENCRYPTION_SALT = 'abcdef1234567890';
  });

  describe('Core Encryption (AES-256-GCM)', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Sensitive data 123';
      const encrypted = EncryptionService.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^enc:v\d{2}:/); // Starts with our prefix

      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'Same plaintext';
      const enc1 = EncryptionService.encrypt(plaintext);
      const enc2 = EncryptionService.encrypt(plaintext);

      expect(enc1).not.toBe(enc2);
      expect(EncryptionService.decrypt(enc1)).toBe(plaintext);
      expect(EncryptionService.decrypt(enc2)).toBe(plaintext);
    });

    it('should throw error for tampered ciphertext (GCM Auth Tag validation)', () => {
      const encrypted = EncryptionService.encrypt('Secure message');
      // Format: enc:vXX:iv:authTag:ciphertext
      const parts = encrypted.split(':');
      const ciphertext = parts[4];

      // Tamper with the ciphertext (flip last char)
      const tamperedCiphertext =
        ciphertext.substring(0, ciphertext.length - 1) + (ciphertext.endsWith('0') ? '1' : '0');

      parts[4] = tamperedCiphertext;
      const tamperedEncrypted = parts.join(':');

      expect(() => EncryptionService.decrypt(tamperedEncrypted)).toThrow(/Decryption failed/);
    });
  });

  describe('Deterministic Encryption (Searchable)', () => {
    it('should produce same ciphertext for same plaintext (Deterministic IV)', () => {
      const plaintext = 'searchable@example.com';
      const enc1 = EncryptionService.encryptDeterministic(plaintext);
      const enc2 = EncryptionService.encryptDeterministic(plaintext);

      expect(enc1).toBe(enc2);
      expect(enc1).toMatch(/^enc:vd\d{2}:/); // 'd' for deterministic
      expect(EncryptionService.decrypt(enc1)).toBe(plaintext);
    });
  });

  describe('PII Object Protection', () => {
    it('should encrypt PII fields in an object', () => {
      const user = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com', // PII
        ssn: '123-456-789', // PII
        role: 'admin',
      };

      const encrypted = EncryptionService.encryptPII(user);

      expect(encrypted.id).toBe('123');
      expect(encrypted.name).toBe('John Doe');
      expect(EncryptionService.isEncrypted(encrypted.email)).toBe(true);
      expect(EncryptionService.isEncrypted(encrypted.ssn)).toBe(true);
      expect(encrypted.role).toBe('admin');

      // Verify email uses deterministic encryption (if configured in service)
      const encEmail2 = EncryptionService.encryptPII({ email: 'john@example.com' }).email;
      expect(encrypted.email).toBe(encEmail2);
    });

    it('should decrypt all PII fields back to original', () => {
      const original = {
        email: 'test@example.com',
        ssn: '000-00-0000',
        bankAccount: 'PL123456789',
      };

      const encrypted = EncryptionService.encryptPII(original);
      const decrypted = EncryptionService.decryptPII(encrypted);

      expect(decrypted).toEqual(original);
    });
  });

  describe('Security Integrity', () => {
    it('should fail if version is unknown', () => {
      const encrypted = EncryptionService.encrypt('message');
      const tampered = encrypted.replace(/v\d{2}/, 'v99'); // Set impossible version

      expect(() => EncryptionService.decrypt(tampered)).toThrow(/key version 99 not found/);
    });

    it('should identify encrypted vs non-encrypted strings', () => {
      expect(EncryptionService.isEncrypted('normal text')).toBe(false);
      expect(EncryptionService.isEncrypted(EncryptionService.encrypt('secret'))).toBe(true);
    });
  });
});
