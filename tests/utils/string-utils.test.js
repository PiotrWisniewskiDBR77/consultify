/**
 * String Utils Tests
 * Tests for string utility functions
 *
 * @module tests/utils/string-utils.test.js
 */

import { describe, it, expect } from 'vitest';

// String utilities implementation
const stringUtils = {
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  capitalizeWords: (str) => {
    if (!str) return '';
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  truncate: (str, length, suffix = '...') => {
    if (!str || str.length <= length) return str || '';
    return str.substring(0, length - suffix.length) + suffix;
  },

  slugify: (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  camelCase: (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
  },

  snakeCase: (str) => {
    if (!str) return '';
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[^a-z0-9]+/g, '_');
  },

  kebabCase: (str) => {
    if (!str) return '';
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace(/[^a-z0-9]+/g, '-');
  },

  stripHtml: (str) => {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
  },

  escapeHtml: (str) => {
    if (!str) return '';
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (char) => escapeMap[char]);
  },

  unescapeHtml: (str) => {
    if (!str) return '';
    const unescapeMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
    };
    return str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => unescapeMap[entity]);
  },

  initials: (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  },

  pluralize: (count, singular, plural) => {
    if (count === 1) return `${count} ${singular}`;
    return `${count} ${plural || singular + 's'}`;
  },

  pad: (str, length, char = '0', left = true) => {
    str = String(str);
    if (str.length >= length) return str;
    const padding = char.repeat(length - str.length);
    return left ? padding + str : str + padding;
  },

  isEmpty: (str) => {
    return !str || str.trim().length === 0;
  },

  countWords: (str) => {
    if (!str) return 0;
    return str.trim().split(/\s+/).filter(Boolean).length;
  },

  reverse: (str) => {
    if (!str) return '';
    return str.split('').reverse().join('');
  },
};

describe('String Utils Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // CAPITALIZE
  // ═══════════════════════════════════════════════════════════════════

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(stringUtils.capitalize('hello')).toBe('Hello');
    });

    it('should lowercase other letters', () => {
      expect(stringUtils.capitalize('HELLO')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(stringUtils.capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(stringUtils.capitalize('a')).toBe('A');
    });
  });

  describe('capitalizeWords', () => {
    it('should capitalize each word', () => {
      expect(stringUtils.capitalizeWords('hello world')).toBe('Hello World');
    });

    it('should handle single word', () => {
      expect(stringUtils.capitalizeWords('hello')).toBe('Hello');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TRUNCATE
  // ═══════════════════════════════════════════════════════════════════

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(stringUtils.truncate('Hello World!', 8)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(stringUtils.truncate('Hello', 10)).toBe('Hello');
    });

    it('should use custom suffix', () => {
      expect(stringUtils.truncate('Hello World!', 9, '…')).toBe('Hello Wo…');
    });

    it('should handle null/undefined', () => {
      expect(stringUtils.truncate(null, 10)).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SLUGIFY
  // ═══════════════════════════════════════════════════════════════════

  describe('slugify', () => {
    it('should create URL-friendly slug', () => {
      expect(stringUtils.slugify('Hello World!')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(stringUtils.slugify('Hello   World')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      expect(stringUtils.slugify('Hello! @World#')).toBe('hello-world');
    });

    it('should trim dashes', () => {
      expect(stringUtils.slugify('--Hello--')).toBe('hello');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CASE CONVERSIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('camelCase', () => {
    it('should convert to camelCase', () => {
      expect(stringUtils.camelCase('hello world')).toBe('helloWorld');
    });

    it('should handle dashes', () => {
      expect(stringUtils.camelCase('hello-world')).toBe('helloWorld');
    });

    it('should handle underscores', () => {
      expect(stringUtils.camelCase('hello_world')).toBe('helloWorld');
    });
  });

  describe('snakeCase', () => {
    it('should convert to snake_case', () => {
      expect(stringUtils.snakeCase('helloWorld')).toBe('hello_world');
    });

    it('should handle spaces', () => {
      expect(stringUtils.snakeCase('Hello World')).toBe('hello_world');
    });
  });

  describe('kebabCase', () => {
    it('should convert to kebab-case', () => {
      expect(stringUtils.kebabCase('helloWorld')).toBe('hello-world');
    });

    it('should handle spaces', () => {
      expect(stringUtils.kebabCase('Hello World')).toBe('hello-world');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HTML
  // ═══════════════════════════════════════════════════════════════════

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stringUtils.stripHtml('<p>Hello</p>')).toBe('Hello');
    });

    it('should handle nested tags', () => {
      expect(stringUtils.stripHtml('<div><span>Hello</span></div>')).toBe('Hello');
    });

    it('should handle self-closing tags', () => {
      expect(stringUtils.stripHtml('Hello<br/>World')).toBe('HelloWorld');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(stringUtils.escapeHtml('<script>alert("test")</script>')).toBe(
        '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersand', () => {
      expect(stringUtils.escapeHtml('A & B')).toBe('A &amp; B');
    });
  });

  describe('unescapeHtml', () => {
    it('should unescape HTML entities', () => {
      expect(stringUtils.unescapeHtml('&lt;p&gt;')).toBe('<p>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INITIALS
  // ═══════════════════════════════════════════════════════════════════

  describe('initials', () => {
    it('should extract initials from name', () => {
      expect(stringUtils.initials('John Doe')).toBe('JD');
    });

    it('should limit to 2 characters', () => {
      expect(stringUtils.initials('John Michael Doe')).toBe('JM');
    });

    it('should handle single name', () => {
      expect(stringUtils.initials('John')).toBe('J');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PLURALIZE
  // ═══════════════════════════════════════════════════════════════════

  describe('pluralize', () => {
    it('should use singular for 1', () => {
      expect(stringUtils.pluralize(1, 'item')).toBe('1 item');
    });

    it('should use plural for 0', () => {
      expect(stringUtils.pluralize(0, 'item')).toBe('0 items');
    });

    it('should use plural for > 1', () => {
      expect(stringUtils.pluralize(5, 'item')).toBe('5 items');
    });

    it('should use custom plural', () => {
      expect(stringUtils.pluralize(2, 'child', 'children')).toBe('2 children');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PAD
  // ═══════════════════════════════════════════════════════════════════

  describe('pad', () => {
    it('should pad left by default', () => {
      expect(stringUtils.pad('5', 3)).toBe('005');
    });

    it('should pad right when specified', () => {
      expect(stringUtils.pad('5', 3, '0', false)).toBe('500');
    });

    it('should use custom character', () => {
      expect(stringUtils.pad('5', 3, 'x')).toBe('xx5');
    });

    it('should not pad if already long enough', () => {
      expect(stringUtils.pad('123', 3)).toBe('123');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // OTHER
  // ═══════════════════════════════════════════════════════════════════

  describe('isEmpty', () => {
    it('should return true for empty string', () => {
      expect(stringUtils.isEmpty('')).toBe(true);
    });

    it('should return true for whitespace', () => {
      expect(stringUtils.isEmpty('   ')).toBe(true);
    });

    it('should return false for non-empty', () => {
      expect(stringUtils.isEmpty('hello')).toBe(false);
    });

    it('should return true for null', () => {
      expect(stringUtils.isEmpty(null)).toBe(true);
    });
  });

  describe('countWords', () => {
    it('should count words', () => {
      expect(stringUtils.countWords('hello world')).toBe(2);
    });

    it('should handle multiple spaces', () => {
      expect(stringUtils.countWords('hello    world')).toBe(2);
    });

    it('should return 0 for empty', () => {
      expect(stringUtils.countWords('')).toBe(0);
    });
  });

  describe('reverse', () => {
    it('should reverse string', () => {
      expect(stringUtils.reverse('hello')).toBe('olleh');
    });

    it('should handle empty string', () => {
      expect(stringUtils.reverse('')).toBe('');
    });
  });
});
