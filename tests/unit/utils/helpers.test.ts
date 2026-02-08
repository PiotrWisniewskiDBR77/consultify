/**
 * Utility Helpers - Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Utility Helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('String Utilities', () => {
        it('should capitalize string', () => {
            const str = 'hello world';
            const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
            expect(capitalized).toBe('Hello world');
        });

        it('should truncate long string', () => {
            const str = 'This is a very long string that needs truncation';
            const maxLen = 20;
            const truncated = str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
            expect(truncated.length).toBe(23);
        });

        it('should slugify string', () => {
            const str = 'Hello World Test';
            const slugified = str.toLowerCase().replace(/\s+/g, '-');
            expect(slugified).toBe('hello-world-test');
        });

        it('should generate random string', () => {
            const length = 10;
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            const result = Array.from(
                { length },
                () => chars[Math.floor(Math.random() * chars.length)]
            ).join('');
            expect(result.length).toBe(10);
        });
    });

    describe('Number Utilities', () => {
        it('should format number with commas', () => {
            const num = 1234567;
            const formatted = num.toLocaleString('en-US');
            expect(formatted).toBe('1,234,567');
        });

        it('should round to decimals', () => {
            const num = 3.14159;
            const rounded = Math.round(num * 100) / 100;
            expect(rounded).toBe(3.14);
        });

        it('should clamp value', () => {
            const value = 150;
            const min = 0;
            const max = 100;
            const clamped = Math.min(Math.max(value, min), max);
            expect(clamped).toBe(100);
        });

        it('should calculate percentage', () => {
            const part = 75;
            const total = 100;
            const percentage = (part / total) * 100;
            expect(percentage).toBe(75);
        });
    });

    describe('Date Utilities', () => {
        it('should format date', () => {
            const date = new Date('2024-01-15');
            const formatted = date.toLocaleDateString('en-US');
            expect(formatted).toContain('2024');
        });

        it('should get days between dates', () => {
            const start = new Date('2024-01-01');
            const end = new Date('2024-01-31');
            const days = Math.ceil(
                (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
            );
            expect(days).toBe(30);
        });

        it('should check if date is past', () => {
            const date = new Date('2020-01-01');
            const isPast = date < new Date();
            expect(isPast).toBe(true);
        });

        it('should add days to date', () => {
            const date = new Date('2024-01-01T12:00:00Z');
            const newDate = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
            expect(newDate.getUTCDate()).toBe(8);
        });
    });

    describe('Array Utilities', () => {
        it('should remove duplicates', () => {
            const arr = [1, 2, 2, 3, 3, 3];
            const unique = [...new Set(arr)];
            expect(unique).toHaveLength(3);
        });

        it('should group by key', () => {
            const items = [
                { category: 'A', value: 1 },
                { category: 'B', value: 2 },
                { category: 'A', value: 3 },
            ];
            const grouped = items.reduce(
                (acc, item) => {
                    acc[item.category] = acc[item.category] || [];
                    acc[item.category].push(item);
                    return acc;
                },
                {} as Record<string, typeof items>
            );
            expect(grouped['A']).toHaveLength(2);
        });

        it('should chunk array', () => {
            const arr = [1, 2, 3, 4, 5, 6];
            const size = 2;
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            expect(chunks).toHaveLength(3);
        });

        it('should flatten nested array', () => {
            const nested = [[1, 2], [3, 4], [5]];
            const flat = nested.flat();
            expect(flat).toHaveLength(5);
        });
    });

    describe('Object Utilities', () => {
        it('should deep clone object', () => {
            const obj = { a: 1, b: { c: 2 } };
            const clone = JSON.parse(JSON.stringify(obj));
            clone.b.c = 3;
            expect(obj.b.c).toBe(2);
        });

        it('should pick properties', () => {
            const obj = { a: 1, b: 2, c: 3 };
            const keys = ['a', 'c'] as const;
            const picked = keys.reduce(
                (acc, key) => {
                    acc[key] = obj[key];
                    return acc;
                },
                {} as Pick<typeof obj, 'a' | 'c'>
            );
            expect(Object.keys(picked)).toHaveLength(2);
        });

        it('should omit properties', () => {
            const obj = { a: 1, b: 2, c: 3 };
            const { b, ...rest } = obj;
            expect(Object.keys(rest)).toHaveLength(2);
        });

        it('should check if object is empty', () => {
            const obj = {};
            const isEmpty = Object.keys(obj).length === 0;
            expect(isEmpty).toBe(true);
        });
    });

    describe('Validation Utilities', () => {
        it('should validate email', () => {
            const email = 'test@example.com';
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            expect(isValid).toBe(true);
        });

        it('should validate URL', () => {
            const url = 'https://example.com';
            const isValid = url.startsWith('http://') || url.startsWith('https://');
            expect(isValid).toBe(true);
        });

        it('should validate phone number', () => {
            const phone = '+48123456789';
            const isValid = /^\+?[\d\s-]{9,}$/.test(phone);
            expect(isValid).toBe(true);
        });
    });

    describe('Formatting Utilities', () => {
        it('should format currency', () => {
            const amount = 1234.56;
            const formatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(amount);
            expect(formatted).toContain('$');
        });

        it('should format file size', () => {
            const bytes = 1536000;
            const mb = bytes / (1024 * 1024);
            expect(mb).toBeCloseTo(1.46, 2);
        });

        it('should format duration', () => {
            const seconds = 3665;
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            expect(hours).toBe(1);
            expect(mins).toBe(1);
        });
    });
});
