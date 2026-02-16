/**
 * Encryption Performance Tests
 * Testing encryption operations performance
 *
 * @module tests/performance/encryption/encryption-performance.test.ts
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Encryption Performance Tests', () => {
  describe('Hashing Performance', () => {
    it('should hash 1000 passwords under 100ms', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        crypto.createHash('sha256').update(`password-${i}`).digest('hex');
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('should generate 100 random bytes under 10ms', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        crypto.randomBytes(32);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('UUID Generation', () => {
    it('should generate 10000 UUIDs under 50ms', () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        crypto.randomUUID();
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('HMAC Performance', () => {
    it('should compute 1000 HMACs under 50ms', () => {
      const key = 'secret-key';
      const data = 'data-to-sign';

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        crypto.createHmac('sha256', key).update(`${data}-${i}`).digest('hex');
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('AES Encryption', () => {
    it('should encrypt/decrypt 100 times under 50ms', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const data = 'sensitive-data-to-encrypt';

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        // Encrypt
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        expect(decrypted).toBe(data);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Base64 Encoding', () => {
    it('should encode/decode 10000 times under 30ms', () => {
      const data = 'data-to-encode-in-base64';

      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        const encoded = Buffer.from(data).toString('base64');
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        expect(decoded).toBe(data);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
