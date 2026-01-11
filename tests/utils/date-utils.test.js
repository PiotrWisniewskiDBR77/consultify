/**
 * Date Utils Tests
 * Tests for date utility functions
 *
 * @module tests/utils/date-utils.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Date utilities implementation
const dateUtils = {
  format: (date, format = 'YYYY-MM-DD') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  parse: (dateString, format = 'YYYY-MM-DD') => {
    // Simple parser for YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateString);
  },

  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  addMonths: (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },

  addYears: (date, years) => {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  },

  diffDays: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  diffMonths: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  },

  isToday: (date) => {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  },

  isYesterday: (date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const d = new Date(date);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  },

  isFuture: (date) => {
    return new Date(date) > new Date();
  },

  isPast: (date) => {
    return new Date(date) < new Date();
  },

  startOfDay: (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  endOfDay: (date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  startOfMonth: (date) => {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  endOfMonth: (date) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  isWeekend: (date) => {
    const day = new Date(date).getDay();
    return day === 0 || day === 6;
  },

  isLeapYear: (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  },

  getAge: (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  },

  relativeTime: (date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffDay < 30)
      return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) > 1 ? 's' : ''} ago`;
    return dateUtils.format(date, 'YYYY-MM-DD');
  },

  isValid: (date) => {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  },
};

describe('Date Utils Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // FORMAT
  // ═══════════════════════════════════════════════════════════════════

  describe('format', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      expect(dateUtils.format(date, 'YYYY-MM-DD')).toBe('2024-01-15');
    });

    it('should format date with time', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45);
      expect(dateUtils.format(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-01-15 14:30:45');
    });

    it('should pad single digits', () => {
      const date = new Date(2024, 0, 5);
      expect(dateUtils.format(date, 'YYYY-MM-DD')).toBe('2024-01-05');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PARSE
  // ═══════════════════════════════════════════════════════════════════

  describe('parse', () => {
    it('should parse date from YYYY-MM-DD', () => {
      const date = dateUtils.parse('2024-01-15');
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ADD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('addDays', () => {
    it('should add days', () => {
      const date = new Date(2024, 0, 15);
      const result = dateUtils.addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should handle month overflow', () => {
      const date = new Date(2024, 0, 30);
      const result = dateUtils.addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
    });

    it('should subtract days with negative', () => {
      const date = new Date(2024, 0, 15);
      const result = dateUtils.addDays(date, -5);
      expect(result.getDate()).toBe(10);
    });
  });

  describe('addMonths', () => {
    it('should add months', () => {
      const date = new Date(2024, 0, 15);
      const result = dateUtils.addMonths(date, 2);
      expect(result.getMonth()).toBe(2); // March
    });

    it('should handle year overflow', () => {
      const date = new Date(2024, 10, 15); // November
      const result = dateUtils.addMonths(date, 3);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('addYears', () => {
    it('should add years', () => {
      const date = new Date(2024, 0, 15);
      const result = dateUtils.addYears(date, 2);
      expect(result.getFullYear()).toBe(2026);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DIFF OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('diffDays', () => {
    it('should calculate difference in days', () => {
      const date1 = new Date(2024, 0, 1);
      const date2 = new Date(2024, 0, 10);
      expect(dateUtils.diffDays(date1, date2)).toBe(9);
    });

    it('should return positive regardless of order', () => {
      const date1 = new Date(2024, 0, 10);
      const date2 = new Date(2024, 0, 1);
      expect(dateUtils.diffDays(date1, date2)).toBe(9);
    });
  });

  describe('diffMonths', () => {
    it('should calculate difference in months', () => {
      const date1 = new Date(2024, 0, 1);
      const date2 = new Date(2024, 5, 1);
      expect(dateUtils.diffMonths(date1, date2)).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // COMPARISONS
  // ═══════════════════════════════════════════════════════════════════

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(dateUtils.isToday(new Date())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isToday(yesterday)).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isYesterday(yesterday)).toBe(true);
    });
  });

  describe('isFuture', () => {
    it('should return true for future date', () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      expect(dateUtils.isFuture(future)).toBe(true);
    });

    it('should return false for past date', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(dateUtils.isFuture(past)).toBe(false);
    });
  });

  describe('isPast', () => {
    it('should return true for past date', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(dateUtils.isPast(past)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BOUNDARIES
  // ═══════════════════════════════════════════════════════════════════

  describe('startOfDay', () => {
    it('should set time to 00:00:00', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45);
      const result = dateUtils.startOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('endOfDay', () => {
    it('should set time to 23:59:59', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45);
      const result = dateUtils.endOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
    });
  });

  describe('startOfMonth', () => {
    it('should set to first day of month', () => {
      const date = new Date(2024, 0, 15);
      const result = dateUtils.startOfMonth(date);
      expect(result.getDate()).toBe(1);
    });
  });

  describe('endOfMonth', () => {
    it('should set to last day of month', () => {
      const date = new Date(2024, 0, 15);
      const result = dateUtils.endOfMonth(date);
      expect(result.getDate()).toBe(31);
    });

    it('should handle February', () => {
      const date = new Date(2024, 1, 15); // February in leap year
      const result = dateUtils.endOfMonth(date);
      expect(result.getDate()).toBe(29);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // OTHER
  // ═══════════════════════════════════════════════════════════════════

  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      const saturday = new Date(2024, 0, 6); // Saturday
      expect(dateUtils.isWeekend(saturday)).toBe(true);
    });

    it('should return true for Sunday', () => {
      const sunday = new Date(2024, 0, 7); // Sunday
      expect(dateUtils.isWeekend(sunday)).toBe(true);
    });

    it('should return false for weekday', () => {
      const monday = new Date(2024, 0, 8); // Monday
      expect(dateUtils.isWeekend(monday)).toBe(false);
    });
  });

  describe('isLeapYear', () => {
    it('should return true for 2024', () => {
      expect(dateUtils.isLeapYear(2024)).toBe(true);
    });

    it('should return false for 2023', () => {
      expect(dateUtils.isLeapYear(2023)).toBe(false);
    });

    it('should return false for 1900', () => {
      expect(dateUtils.isLeapYear(1900)).toBe(false);
    });

    it('should return true for 2000', () => {
      expect(dateUtils.isLeapYear(2000)).toBe(true);
    });
  });

  describe('isValid', () => {
    it('should return true for valid date', () => {
      expect(dateUtils.isValid(new Date())).toBe(true);
    });

    it('should return true for valid string', () => {
      expect(dateUtils.isValid('2024-01-15')).toBe(true);
    });

    it('should return false for invalid date', () => {
      expect(dateUtils.isValid('not a date')).toBe(false);
    });
  });
});
