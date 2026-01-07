/**
 * Number and Math Utilities Tests
 * Tests for number formatting and math operations
 * 
 * @module tests/numbers/number-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Number utilities
const createNumberUtils = () => {
    return {
        clamp: (value, min, max) => Math.min(Math.max(value, min), max),

        round: (value, decimals = 0) => {
            const factor = Math.pow(10, decimals);
            return Math.round(value * factor) / factor;
        },

        floor: (value, decimals = 0) => {
            const factor = Math.pow(10, decimals);
            return Math.floor(value * factor) / factor;
        },

        ceil: (value, decimals = 0) => {
            const factor = Math.pow(10, decimals);
            return Math.ceil(value * factor) / factor;
        },

        isInteger: (value) => Number.isInteger(value),

        isFinite: (value) => Number.isFinite(value),

        isNaN: (value) => Number.isNaN(value),

        inRange: (value, min, max) => value >= min && value <= max,

        percentage: (value, total) => (total === 0 ? 0 : (value / total) * 100),

        percentOf: (percent, total) => (percent / 100) * total,

        sum: (numbers) => numbers.reduce((a, b) => a + b, 0),

        average: (numbers) => numbers.length === 0 ? 0 : this.sum(numbers) / numbers.length,

        median: (numbers) => {
            if (numbers.length === 0) return 0;
            const sorted = [...numbers].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        },

        mode: (numbers) => {
            const freq = new Map();
            let maxFreq = 0;
            let mode = null;

            for (const n of numbers) {
                const count = (freq.get(n) || 0) + 1;
                freq.set(n, count);
                if (count > maxFreq) {
                    maxFreq = count;
                    mode = n;
                }
            }

            return mode;
        },

        variance: (numbers) => {
            const avg = this.average(numbers);
            return this.average(numbers.map(n => Math.pow(n - avg, 2)));
        },

        stdDev: (numbers) => Math.sqrt(this.variance(numbers)),

        min: (numbers) => Math.min(...numbers),

        max: (numbers) => Math.max(...numbers),

        range: (numbers) => this.max(numbers) - this.min(numbers),
    };
};

// Number formatter
const createNumberFormatter = () => {
    return {
        format: (value, options = {}) => {
            return new Intl.NumberFormat(options.locale || 'en-US', options).format(value);
        },

        currency: (value, currency = 'USD', locale = 'en-US') => {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
            }).format(value);
        },

        percent: (value, decimals = 0) => {
            return new Intl.NumberFormat('en-US', {
                style: 'percent',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value);
        },

        compact: (value) => {
            return new Intl.NumberFormat('en-US', {
                notation: 'compact',
                compactDisplay: 'short',
            }).format(value);
        },

        ordinal: (value) => {
            const suffixes = ['th', 'st', 'nd', 'rd'];
            const v = value % 100;
            return value + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
        },

        bytes: (value, decimals = 2) => {
            if (value === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            const i = Math.floor(Math.log(value) / Math.log(k));
            return parseFloat((value / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
        },

        pad: (value, length, char = '0') => {
            return String(value).padStart(length, char);
        },
    };
};

// Random utilities
const createRandomUtils = (seed = null) => {
    let current = seed || Date.now();

    const random = () => {
        current = (current * 1103515245 + 12345) & 0x7fffffff;
        return current / 0x7fffffff;
    };

    return {
        float: (min = 0, max = 1) => min + random() * (max - min),

        int: (min, max) => Math.floor(min + random() * (max - min + 1)),

        boolean: (probability = 0.5) => random() < probability,

        pick: (array) => array[Math.floor(random() * array.length)],

        shuffle: (array) => {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },

        sample: (array, count) => {
            const shuffled = this.shuffle(array);
            return shuffled.slice(0, count);
        },

        weighted: (items) => {
            const total = items.reduce((sum, item) => sum + item.weight, 0);
            let r = random() * total;

            for (const item of items) {
                r -= item.weight;
                if (r <= 0) return item.value;
            }

            return items[items.length - 1].value;
        },

        gaussian: (mean = 0, stdDev = 1) => {
            const u1 = random();
            const u2 = random();
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            return z * stdDev + mean;
        },

        uuid: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.floor(random() * 16);
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        setSeed: (newSeed) => {
            current = newSeed;
        },
    };
};

describe('Number Utils Tests', () => {
    let utils;

    beforeEach(() => {
        utils = createNumberUtils();
    });

    it('should clamp', () => {
        expect(utils.clamp(5, 0, 10)).toBe(5);
        expect(utils.clamp(-5, 0, 10)).toBe(0);
        expect(utils.clamp(15, 0, 10)).toBe(10);
    });

    it('should round', () => {
        expect(utils.round(3.14159, 2)).toBe(3.14);
        expect(utils.floor(3.99, 0)).toBe(3);
        expect(utils.ceil(3.01, 0)).toBe(4);
    });

    it('should check range', () => {
        expect(utils.inRange(5, 0, 10)).toBe(true);
        expect(utils.inRange(15, 0, 10)).toBe(false);
    });

    it('should calculate percentage', () => {
        expect(utils.percentage(25, 100)).toBe(25);
        expect(utils.percentOf(50, 200)).toBe(100);
    });

    it('should calculate statistics', () => {
        const nums = [1, 2, 3, 4, 5];

        expect(utils.sum(nums)).toBe(15);
        expect(utils.average(nums)).toBe(3);
        expect(utils.median(nums)).toBe(3);
        expect(utils.min(nums)).toBe(1);
        expect(utils.max(nums)).toBe(5);
    });

    it('should calculate mode', () => {
        expect(utils.mode([1, 2, 2, 3])).toBe(2);
    });

    it('should calculate variance and stdDev', () => {
        const nums = [2, 4, 4, 4, 5, 5, 7, 9];
        expect(utils.variance(nums)).toBeCloseTo(4);
        expect(utils.stdDev(nums)).toBeCloseTo(2);
    });
});

describe('Number Formatter Tests', () => {
    let formatter;

    beforeEach(() => {
        formatter = createNumberFormatter();
    });

    it('should format currency', () => {
        expect(formatter.currency(1234.56)).toContain('1,234.56');
    });

    it('should format percent', () => {
        expect(formatter.percent(0.1234, 1)).toBe('12.3%');
    });

    it('should format compact', () => {
        expect(formatter.compact(1500)).toMatch(/1\.5K/);
        expect(formatter.compact(1500000)).toMatch(/1\.5M/);
    });

    it('should format ordinal', () => {
        expect(formatter.ordinal(1)).toBe('1st');
        expect(formatter.ordinal(2)).toBe('2nd');
        expect(formatter.ordinal(3)).toBe('3rd');
        expect(formatter.ordinal(4)).toBe('4th');
        expect(formatter.ordinal(11)).toBe('11th');
        expect(formatter.ordinal(21)).toBe('21st');
    });

    it('should format bytes', () => {
        expect(formatter.bytes(0)).toBe('0 B');
        expect(formatter.bytes(1024)).toBe('1 KB');
        expect(formatter.bytes(1048576)).toBe('1 MB');
    });

    it('should pad numbers', () => {
        expect(formatter.pad(5, 3)).toBe('005');
        expect(formatter.pad(42, 4)).toBe('0042');
    });
});

describe('Random Utils Tests', () => {
    let random;

    beforeEach(() => {
        random = createRandomUtils(12345);
    });

    it('should generate float in range', () => {
        const value = random.float(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
    });

    it('should generate int in range', () => {
        const value = random.int(1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
    });

    it('should pick from array', () => {
        const items = ['a', 'b', 'c'];
        const picked = random.pick(items);
        expect(items).toContain(picked);
    });

    it('should shuffle array', () => {
        const items = [1, 2, 3, 4, 5];
        const shuffled = random.shuffle(items);

        expect(shuffled).toHaveLength(5);
        expect(shuffled.sort()).toEqual(items);
    });

    it('should sample from array', () => {
        const items = [1, 2, 3, 4, 5];
        const sample = random.sample(items, 3);

        expect(sample).toHaveLength(3);
    });

    it('should be reproducible with seed', () => {
        const r1 = createRandomUtils(42);
        const r2 = createRandomUtils(42);

        expect(r1.float()).toBe(r2.float());
        expect(r1.int(0, 100)).toBe(r2.int(0, 100));
    });
});
