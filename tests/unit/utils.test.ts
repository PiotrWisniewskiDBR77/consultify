import { describe, it, expect } from 'vitest';

/**
 * Level 1: Unit Tests - Utility Functions
 * Tests helper functions and utilities
 */

// Common utility functions for testing
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
};

const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

const capitalizeFirst = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T => {
  let timeoutId: NodeJS.Timeout;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
};

describe('Unit Test: Utilities', () => {
  describe('formatNumber', () => {
    it('should format numbers in thousands', () => {
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(999000)).toBe('999.0K');
    });

    it('should format numbers in millions', () => {
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(2500000)).toBe('2.5M');
    });

    it('should keep small numbers as is', () => {
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(999)).toBe('999');
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(99.99)).toBe('$99.99');
    });

    it('should format EUR currency', () => {
      expect(formatCurrency(1000, 'EUR')).toContain('1,000.00');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text with ellipsis', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
      expect(truncateText('Short', 10)).toBe('Short');
    });

    it('should not truncate text within limit', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });
  });

  describe('capitalizeFirst', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeFirst('hello')).toBe('Hello');
      expect(capitalizeFirst('HELLO')).toBe('Hello');
    });

    it('should handle empty strings', () => {
      expect(capitalizeFirst('')).toBe('');
    });
  });

  describe('slugify', () => {
    it('should create URL-friendly slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Test  Multiple   Spaces')).toBe('test-multiple-spaces');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello! World?')).toBe('hello-world');
    });
  });

  describe('debounce', () => {
    it('should return a function', () => {
      const fn = debounce(() => {}, 100);
      expect(typeof fn).toBe('function');
    });
  });
});
