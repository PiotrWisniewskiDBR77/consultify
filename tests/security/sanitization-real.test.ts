/**
 * Real Input Sanitization & SQL Guard Tests (P0)
 *
 * Tests the ACTUAL utilities in security.utils.ts.
 * Verifies:
 * - XSS neutralization
 * - SQL Table/Column allowlist validation
 * - Identifier escaping
 * - Path traversal prevention (filename sanitization)
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  validateTableName,
  validateColumnName,
  safeIdentifier,
  sanitizeFilename,
} from '../../server/src/utils/security.utils';

describe('Real Security Utils (P0)', () => {
  describe('XSS Prevention (DOM-based & Server-side)', () => {
    it('should neutralize malicious HTML tags', () => {
      const payload = '<script>alert("XSS")</script><img src=x onerror=evil()>';
      const sanitized = sanitizeString(payload);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&lt;img');
    });

    it('should handle recursive object sanitization', () => {
      const input = {
        nested: {
          value: '<p>test</p>',
        },
        array: ['<b>bold</b>', 123],
      };
      const sanitized = sanitizeObject(input);
      expect(sanitized.nested.value).toBe('&lt;p&gt;test&lt;&#x2F;p&gt;');
      expect(sanitized.array[0]).toBe('&lt;b&gt;bold&lt;&#x2F;b&gt;');
      expect(sanitized.array[1]).toBe(123);
    });
  });

  describe('SQL Injection Prevention (Structural Guards)', () => {
    it('should allow valid table names from allowlist', () => {
      expect(validateTableName('users')).toBe('users');
      expect(validateTableName('projects ')).toBe('projects'); // trim test
    });

    it('should throw error for invalid table names (blacklist/non-allowlist)', () => {
      expect(() => validateTableName('users; DROP TABLE users')).toThrow(/Invalid table name/);
      expect(() => validateTableName('secret_config')).toThrow(/Invalid table name/);
    });

    it('should allow valid column names', () => {
      expect(validateColumnName('email')).toBe('email');
      expect(validateColumnName('created_at')).toBe('created_at');
    });

    it('should secure identifiers from injection attempts', () => {
      // safeIdentifier cleans alphanumeric and underscores
      expect(safeIdentifier('user_id;--', 'column')).toBe('user_id');
      expect(() => safeIdentifier('something_else', 'table')).toThrow();
    });
  });

  describe('File System Security', () => {
    it('should prevent path traversal in filenames', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('___etc_passwd');
      expect(sanitizeFilename('..\\..\\win.ini')).toBe('__win.ini'); // .. is removed, \ becomes _
      expect(sanitizeFilename('my.file.txt')).toBe('my.file.txt');
    });

    it('should limit filename length to 255', () => {
      const longName = 'a'.repeat(300) + '.txt';
      expect(sanitizeFilename(longName).length).toBe(255);
    });
  });
});
