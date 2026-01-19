/**
 * Input Sanitization Tests
 * Tests for input sanitization utilities
 *
 * @module tests/sanitize/sanitizer.test.js
 */

import { describe, it, expect } from 'vitest';

// Sanitization utilities
const sanitizer = {
  // HTML sanitization
  html: (input) => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Reverse HTML entities
  unescapeHtml: (input) => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  },

  // SQL injection prevention
  sql: (input) => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  },

  // URL sanitization
  url: (input) => {
    if (typeof input !== 'string') return '';
    try {
      const url = new URL(input);
      // Only allow http and https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return '';
      }
      return url.href;
    } catch {
      return '';
    }
  },

  // Email sanitization
  email: (input) => {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed) ? trimmed : '';
  },

  // Phone sanitization (keep only digits and +)
  phone: (input) => {
    if (typeof input !== 'string') return '';
    return input.replace(/[^\d+]/g, '');
  },

  // Filename sanitization
  filename: (input) => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/^\.+/, '')
      .trim()
      .substring(0, 255);
  },

  // Alphanumeric only
  alphanumeric: (input) => {
    if (typeof input !== 'string') return '';
    return input.replace(/[^a-zA-Z0-9]/g, '');
  },

  // Slug generation
  slug: (input) => {
    if (typeof input !== 'string') return '';
    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  // Strip all HTML tags
  stripTags: (input) => {
    if (typeof input !== 'string') return '';
    return input.replace(/<[^>]*>/g, '');
  },

  // Trim and collapse whitespace
  whitespace: (input) => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/\s+/g, ' ');
  },

  // JSON safe string
  json: (input) => {
    if (typeof input !== 'string') return '';
    return JSON.stringify(input).slice(1, -1);
  },
};

describe('Input Sanitization Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // HTML SANITIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('HTML Sanitization', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizer.html(input);

      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('should escape all special characters', () => {
      const input = '<>&"\'/';
      const result = sanitizer.html(input);

      expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;');
    });

    it('should handle empty input', () => {
      expect(sanitizer.html('')).toBe('');
      expect(sanitizer.html(null)).toBe('');
    });

    it('should unescape HTML entities', () => {
      const input = '&lt;script&gt;';
      const result = sanitizer.unescapeHtml(input);

      expect(result).toBe('<script>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SQL SANITIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('SQL Sanitization', () => {
    it('should escape single quotes', () => {
      const input = "O'Brien";
      const result = sanitizer.sql(input);

      expect(result).toBe("O''Brien");
    });

    it('should escape injection attempt', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizer.sql(input);

      expect(result).toBe("''; DROP TABLE users; --");
    });

    it('should escape backslashes', () => {
      const input = 'path\\to\\file';
      const result = sanitizer.sql(input);

      expect(result).toBe('path\\\\to\\\\file');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // URL SANITIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('URL Sanitization', () => {
    it('should allow http URL', () => {
      const result = sanitizer.url('http://example.com/path');

      expect(result).toBe('http://example.com/path');
    });

    it('should allow https URL', () => {
      const result = sanitizer.url('https://example.com');

      expect(result).toBe('https://example.com/');
    });

    it('should reject javascript protocol', () => {
      const result = sanitizer.url('javascript:alert(1)');

      expect(result).toBe('');
    });

    it('should reject data protocol', () => {
      const result = sanitizer.url('data:text/html,<script>alert(1)</script>');

      expect(result).toBe('');
    });

    it('should reject invalid URL', () => {
      const result = sanitizer.url('not a url');

      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL SANITIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Email Sanitization', () => {
    it('should validate and lowercase email', () => {
      const result = sanitizer.email('  User@Example.COM  ');

      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email', () => {
      expect(sanitizer.email('not-an-email')).toBe('');
      expect(sanitizer.email('missing@domain')).toBe('');
      expect(sanitizer.email('@no-local.com')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHONE SANITIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Phone Sanitization', () => {
    it('should extract digits and plus', () => {
      const result = sanitizer.phone('+1 (555) 123-4567');

      expect(result).toBe('+15551234567');
    });

    it('should handle various formats', () => {
      expect(sanitizer.phone('555.123.4567')).toBe('5551234567');
      expect(sanitizer.phone('555-123-4567')).toBe('5551234567');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FILENAME SANITIZATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Filename Sanitization', () => {
    it('should remove invalid characters', () => {
      const result = sanitizer.filename('file<name>.txt');

      expect(result).toBe('filename.txt');
    });

    it('should remove leading dots', () => {
      const result = sanitizer.filename('...hidden');

      expect(result).toBe('hidden');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizer.filename(longName);

      expect(result.length).toBe(255);
    });

    it('should handle path traversal attempt', () => {
      const result = sanitizer.filename('../../../etc/passwd');

      expect(result).not.toContain('..');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ALPHANUMERIC
  // ═══════════════════════════════════════════════════════════════════

  describe('Alphanumeric', () => {
    it('should keep only alphanumeric', () => {
      const result = sanitizer.alphanumeric('abc123!@#XYZ');

      expect(result).toBe('abc123XYZ');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SLUG
  // ═══════════════════════════════════════════════════════════════════

  describe('Slug', () => {
    it('should create slug', () => {
      const result = sanitizer.slug('Hello, World! This is a Test.');

      expect(result).toBe('hello-world-this-is-a-test');
    });

    it('should handle multiple spaces and dashes', () => {
      const result = sanitizer.slug('  multiple   spaces  ');

      expect(result).toBe('multiple-spaces');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STRIP TAGS
  // ═══════════════════════════════════════════════════════════════════

  describe('Strip Tags', () => {
    it('should remove HTML tags', () => {
      const result = sanitizer.stripTags('<p>Hello <b>World</b></p>');

      expect(result).toBe('Hello World');
    });

    it('should handle nested tags', () => {
      const result = sanitizer.stripTags('<div><span><a href="#">Link</a></span></div>');

      expect(result).toBe('Link');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // WHITESPACE
  // ═══════════════════════════════════════════════════════════════════

  describe('Whitespace', () => {
    it('should normalize whitespace', () => {
      const result = sanitizer.whitespace('  hello   world  ');

      expect(result).toBe('hello world');
    });

    it('should handle tabs and newlines', () => {
      const result = sanitizer.whitespace('hello\t\n\r  world');

      expect(result).toBe('hello world');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // JSON
  // ═══════════════════════════════════════════════════════════════════

  describe('JSON', () => {
    it('should escape for JSON', () => {
      const result = sanitizer.json('line1\nline2\ttab');

      expect(result).toBe('line1\\nline2\\ttab');
    });

    it('should escape quotes', () => {
      const result = sanitizer.json('say "hello"');

      expect(result).toBe('say \\"hello\\"');
    });
  });
});
