/**
 * Number Utils Tests
 * Tests for number utility functions
 * 
 * @module tests/utils/number-utils.test.js
 */

import { describe, it, expect } from 'vitest';

// Number utilities implementation
const numberUtils = {
    formatNumber: (num, locale = 'en-US') => {
        return new Intl.NumberFormat(locale).format(num);
    },

    formatCurrency: (num, currency = 'USD', locale = 'en-US') => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
        }).format(num);
    },

    formatPercent: (num, decimals = 0) => {
        return (num * 100).toFixed(decimals) + '%';
    },

    round: (num, decimals = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    },

    floor: (num, decimals = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.floor(num * factor) / factor;
    },

    ceil: (num, decimals = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.ceil(num * factor) / factor;
    },

    clamp: (num, min, max) => {
        return Math.min(Math.max(num, min), max);
    },

    isPositive: (num) => num > 0,
    isNegative: (num) => num < 0,
    isZero: (num) => num === 0,
    isEven: (num) => num % 2 === 0,
    isOdd: (num) => num % 2 !== 0,
    isInteger: (num) => Number.isInteger(num),
    isFloat: (num) => !Number.isInteger(num) && Number.isFinite(num),

    sum: (arr) => arr.reduce((a, b) => a + b, 0),
    average: (arr) => arr.length === 0 ? 0 : numberUtils.sum(arr) / arr.length,
    min: (arr) => Math.min(...arr),
    max: (arr) => Math.max(...arr),
    median: (arr) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    },

    range: (start, end, step = 1) => {
        const result = [];
        for (let i = start; i < end; i += step) {
            result.push(i);
        }
        return result;
    },

    random: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randomFloat: (min, max) => {
        return Math.random() * (max - min) + min;
    },

    toOrdinal: (num) => {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = num % 100;
        return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    },

    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },

    formatCompact: (num) => {
        if (num < 1000) return String(num);
        if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
        return (num / 1000000000).toFixed(1) + 'B';
    },

    percentage: (value, total) => {
        if (total === 0) return 0;
        return (value / total) * 100;
    },

    lerp: (start, end, t) => {
        return start + (end - start) * t;
    },

    mapRange: (value, inMin, inMax, outMin, outMax) => {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    },
};

describe('Number Utils Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // FORMATTING
    // ═══════════════════════════════════════════════════════════════════

    describe('formatNumber', () => {
        it('should format with thousand separators', () => {
            expect(numberUtils.formatNumber(1234567)).toBe('1,234,567');
        });

        it('should handle decimals', () => {
            expect(numberUtils.formatNumber(1234.56)).toBe('1,234.56');
        });
    });

    describe('formatCurrency', () => {
        it('should format USD', () => {
            expect(numberUtils.formatCurrency(1234.56)).toBe('$1,234.56');
        });

        it('should handle different currencies', () => {
            const result = numberUtils.formatCurrency(1234.56, 'EUR', 'de-DE');
            expect(result).toContain('€');
        });
    });

    describe('formatPercent', () => {
        it('should format as percentage', () => {
            expect(numberUtils.formatPercent(0.5)).toBe('50%');
        });

        it('should handle decimals', () => {
            expect(numberUtils.formatPercent(0.554, 1)).toBe('55.4%');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ROUNDING
    // ═══════════════════════════════════════════════════════════════════

    describe('round', () => {
        it('should round to nearest integer', () => {
            expect(numberUtils.round(3.7)).toBe(4);
        });

        it('should round to decimals', () => {
            expect(numberUtils.round(3.456, 2)).toBe(3.46);
        });
    });

    describe('floor', () => {
        it('should floor to integer', () => {
            expect(numberUtils.floor(3.9)).toBe(3);
        });

        it('should floor to decimals', () => {
            expect(numberUtils.floor(3.456, 2)).toBe(3.45);
        });
    });

    describe('ceil', () => {
        it('should ceil to integer', () => {
            expect(numberUtils.ceil(3.1)).toBe(4);
        });

        it('should ceil to decimals', () => {
            expect(numberUtils.ceil(3.451, 2)).toBe(3.46);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLAMP
    // ═══════════════════════════════════════════════════════════════════

    describe('clamp', () => {
        it('should clamp to min', () => {
            expect(numberUtils.clamp(5, 10, 20)).toBe(10);
        });

        it('should clamp to max', () => {
            expect(numberUtils.clamp(25, 10, 20)).toBe(20);
        });

        it('should not change value in range', () => {
            expect(numberUtils.clamp(15, 10, 20)).toBe(15);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CHECKS
    // ═══════════════════════════════════════════════════════════════════

    describe('Number Checks', () => {
        it('isPositive', () => {
            expect(numberUtils.isPositive(5)).toBe(true);
            expect(numberUtils.isPositive(-5)).toBe(false);
            expect(numberUtils.isPositive(0)).toBe(false);
        });

        it('isNegative', () => {
            expect(numberUtils.isNegative(-5)).toBe(true);
            expect(numberUtils.isNegative(5)).toBe(false);
        });

        it('isZero', () => {
            expect(numberUtils.isZero(0)).toBe(true);
            expect(numberUtils.isZero(1)).toBe(false);
        });

        it('isEven', () => {
            expect(numberUtils.isEven(4)).toBe(true);
            expect(numberUtils.isEven(3)).toBe(false);
        });

        it('isOdd', () => {
            expect(numberUtils.isOdd(3)).toBe(true);
            expect(numberUtils.isOdd(4)).toBe(false);
        });

        it('isInteger', () => {
            expect(numberUtils.isInteger(5)).toBe(true);
            expect(numberUtils.isInteger(5.5)).toBe(false);
        });

        it('isFloat', () => {
            expect(numberUtils.isFloat(5.5)).toBe(true);
            expect(numberUtils.isFloat(5)).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ARRAY OPERATIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Array Operations', () => {
        it('sum', () => {
            expect(numberUtils.sum([1, 2, 3, 4, 5])).toBe(15);
        });

        it('average', () => {
            expect(numberUtils.average([1, 2, 3, 4, 5])).toBe(3);
        });

        it('average empty array', () => {
            expect(numberUtils.average([])).toBe(0);
        });

        it('min', () => {
            expect(numberUtils.min([5, 2, 8, 1, 9])).toBe(1);
        });

        it('max', () => {
            expect(numberUtils.max([5, 2, 8, 1, 9])).toBe(9);
        });

        it('median odd', () => {
            expect(numberUtils.median([1, 3, 5])).toBe(3);
        });

        it('median even', () => {
            expect(numberUtils.median([1, 2, 3, 4])).toBe(2.5);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RANGE
    // ═══════════════════════════════════════════════════════════════════

    describe('range', () => {
        it('should generate range', () => {
            expect(numberUtils.range(1, 5)).toEqual([1, 2, 3, 4]);
        });

        it('should respect step', () => {
            expect(numberUtils.range(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ORDINAL
    // ═══════════════════════════════════════════════════════════════════

    describe('toOrdinal', () => {
        it('should format 1st', () => {
            expect(numberUtils.toOrdinal(1)).toBe('1st');
        });

        it('should format 2nd', () => {
            expect(numberUtils.toOrdinal(2)).toBe('2nd');
        });

        it('should format 3rd', () => {
            expect(numberUtils.toOrdinal(3)).toBe('3rd');
        });

        it('should format 4th-10th', () => {
            expect(numberUtils.toOrdinal(4)).toBe('4th');
            expect(numberUtils.toOrdinal(10)).toBe('10th');
        });

        it('should format 11th-13th', () => {
            expect(numberUtils.toOrdinal(11)).toBe('11th');
            expect(numberUtils.toOrdinal(12)).toBe('12th');
            expect(numberUtils.toOrdinal(13)).toBe('13th');
        });

        it('should format 21st', () => {
            expect(numberUtils.toOrdinal(21)).toBe('21st');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FORMAT BYTES
    // ═══════════════════════════════════════════════════════════════════

    describe('formatBytes', () => {
        it('should format bytes', () => {
            expect(numberUtils.formatBytes(500)).toBe('500 B');
        });

        it('should format KB', () => {
            expect(numberUtils.formatBytes(1024)).toBe('1 KB');
        });

        it('should format MB', () => {
            expect(numberUtils.formatBytes(1048576)).toBe('1 MB');
        });

        it('should format GB', () => {
            expect(numberUtils.formatBytes(1073741824)).toBe('1 GB');
        });

        it('should handle 0', () => {
            expect(numberUtils.formatBytes(0)).toBe('0 B');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FORMAT COMPACT
    // ═══════════════════════════════════════════════════════════════════

    describe('formatCompact', () => {
        it('should not change small numbers', () => {
            expect(numberUtils.formatCompact(500)).toBe('500');
        });

        it('should format thousands', () => {
            expect(numberUtils.formatCompact(1500)).toBe('1.5K');
        });

        it('should format millions', () => {
            expect(numberUtils.formatCompact(1500000)).toBe('1.5M');
        });

        it('should format billions', () => {
            expect(numberUtils.formatCompact(1500000000)).toBe('1.5B');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PERCENTAGE
    // ═══════════════════════════════════════════════════════════════════

    describe('percentage', () => {
        it('should calculate percentage', () => {
            expect(numberUtils.percentage(25, 100)).toBe(25);
        });

        it('should handle zero total', () => {
            expect(numberUtils.percentage(25, 0)).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // INTERPOLATION
    // ═══════════════════════════════════════════════════════════════════

    describe('lerp', () => {
        it('should interpolate at 0', () => {
            expect(numberUtils.lerp(0, 100, 0)).toBe(0);
        });

        it('should interpolate at 1', () => {
            expect(numberUtils.lerp(0, 100, 1)).toBe(100);
        });

        it('should interpolate at 0.5', () => {
            expect(numberUtils.lerp(0, 100, 0.5)).toBe(50);
        });
    });

    describe('mapRange', () => {
        it('should map range', () => {
            expect(numberUtils.mapRange(5, 0, 10, 0, 100)).toBe(50);
        });

        it('should map to different range', () => {
            expect(numberUtils.mapRange(50, 0, 100, 0, 10)).toBe(5);
        });
    });
});
