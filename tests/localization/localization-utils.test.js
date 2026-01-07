/**
 * Localization Utilities Tests
 * Tests for date, number, and currency formatting
 * 
 * @module tests/localization/localization-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Number formatter
const createNumberFormatter = (locale = 'en-US') => {
    return {
        format: (value, options = {}) => {
            return new Intl.NumberFormat(locale, options).format(value);
        },

        formatCurrency: (value, currency = 'USD') => {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
            }).format(value);
        },

        formatPercent: (value, decimals = 0) => {
            return new Intl.NumberFormat(locale, {
                style: 'percent',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value);
        },

        formatCompact: (value) => {
            return new Intl.NumberFormat(locale, {
                notation: 'compact',
            }).format(value);
        },

        formatUnit: (value, unit) => {
            return new Intl.NumberFormat(locale, {
                style: 'unit',
                unit,
            }).format(value);
        },

        parse: (str) => {
            // Simple parsing (locale-aware would be more complex)
            return parseFloat(str.replace(/[^0-9.-]/g, ''));
        },

        setLocale: (newLocale) => {
            locale = newLocale;
        },
    };
};

// Date formatter
const createDateFormatter = (locale = 'en-US', timezone = 'UTC') => {
    return {
        format: (date, options = {}) => {
            const d = date instanceof Date ? date : new Date(date);
            return new Intl.DateTimeFormat(locale, {
                timeZone: timezone,
                ...options,
            }).format(d);
        },

        formatDate: (date) => {
            return this.format(date, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        },

        formatTime: (date) => {
            return this.format(date, {
                hour: '2-digit',
                minute: '2-digit',
            });
        },

        formatDateTime: (date) => {
            return this.format(date, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        },

        formatRelative: (date, baseDate = new Date()) => {
            const d = date instanceof Date ? date : new Date(date);
            const diff = d.getTime() - baseDate.getTime();
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

            if (Math.abs(days) >= 1) {
                return rtf.format(days, 'day');
            }
            if (Math.abs(hours) >= 1) {
                return rtf.format(hours, 'hour');
            }
            if (Math.abs(minutes) >= 1) {
                return rtf.format(minutes, 'minute');
            }
            return rtf.format(seconds, 'second');
        },

        setTimezone: (tz) => {
            timezone = tz;
        },
    };
};

// Pluralization
const createPluralizer = (locale = 'en-US') => {
    const rules = new Intl.PluralRules(locale);

    return {
        select: (count) => {
            return rules.select(count);
        },

        format: (count, forms) => {
            const rule = rules.select(count);
            return forms[rule] || forms.other || '';
        },

        formatWithCount: (count, forms) => {
            const text = this.format(count, forms);
            return text.replace('{count}', count.toString());
        },
    };
};

// List formatter
const createListFormatter = (locale = 'en-US') => {
    return {
        format: (items, type = 'conjunction') => {
            return new Intl.ListFormat(locale, {
                style: 'long',
                type,
            }).format(items);
        },

        formatAnd: (items) => {
            return this.format(items, 'conjunction');
        },

        formatOr: (items) => {
            return this.format(items, 'disjunction');
        },

        formatUnit: (items) => {
            return new Intl.ListFormat(locale, {
                style: 'narrow',
                type: 'unit',
            }).format(items);
        },
    };
};

// Collation/sorting
const createCollator = (locale = 'en-US', options = {}) => {
    const collator = new Intl.Collator(locale, options);

    return {
        compare: (a, b) => {
            return collator.compare(a, b);
        },

        sort: (items) => {
            return [...items].sort((a, b) => collator.compare(a, b));
        },

        sortBy: (items, key) => {
            return [...items].sort((a, b) =>
                collator.compare(String(a[key]), String(b[key]))
            );
        },

        equals: (a, b) => {
            return collator.compare(a, b) === 0;
        },
    };
};

// Display names
const createDisplayNames = (locale = 'en-US') => {
    return {
        ofLanguage: (code) => {
            const names = new Intl.DisplayNames([locale], { type: 'language' });
            return names.of(code);
        },

        ofRegion: (code) => {
            const names = new Intl.DisplayNames([locale], { type: 'region' });
            return names.of(code);
        },

        ofCurrency: (code) => {
            const names = new Intl.DisplayNames([locale], { type: 'currency' });
            return names.of(code);
        },
    };
};

describe('Number Formatter Tests', () => {
    let formatter;

    beforeEach(() => {
        formatter = createNumberFormatter('en-US');
    });

    it('should format number', () => {
        expect(formatter.format(1234567)).toBe('1,234,567');
    });

    it('should format currency', () => {
        const result = formatter.formatCurrency(99.99, 'USD');
        expect(result).toContain('99.99');
        expect(result).toContain('$');
    });

    it('should format percent', () => {
        expect(formatter.formatPercent(0.75)).toBe('75%');
    });

    it('should format compact', () => {
        const result = formatter.formatCompact(1500000);
        expect(result).toMatch(/1\.5M|1,5\sM/);
    });

    it('should parse number string', () => {
        expect(formatter.parse('$1,234.56')).toBe(1234.56);
    });
});

describe('Date Formatter Tests', () => {
    let formatter;
    const testDate = new Date('2024-06-15T14:30:00Z');

    beforeEach(() => {
        formatter = createDateFormatter('en-US', 'UTC');
    });

    it('should format date', () => {
        const result = formatter.formatDate(testDate);
        expect(result).toContain('June');
        expect(result).toContain('15');
        expect(result).toContain('2024');
    });

    it('should format time', () => {
        const result = formatter.formatTime(testDate);
        expect(result).toContain('2');
        expect(result).toContain('30');
    });

    it('should format relative time', () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const result = formatter.formatRelative(yesterday, now);
        expect(result.toLowerCase()).toContain('yesterday');
    });
});

describe('Pluralizer Tests', () => {
    let pluralizer;

    beforeEach(() => {
        pluralizer = createPluralizer('en-US');
    });

    it('should select plural form', () => {
        expect(pluralizer.select(1)).toBe('one');
        expect(pluralizer.select(2)).toBe('other');
    });

    it('should format with forms', () => {
        const forms = { one: 'item', other: 'items' };

        expect(pluralizer.format(1, forms)).toBe('item');
        expect(pluralizer.format(5, forms)).toBe('items');
    });

    it('should format with count', () => {
        const forms = { one: '{count} apple', other: '{count} apples' };

        expect(pluralizer.formatWithCount(1, forms)).toBe('1 apple');
        expect(pluralizer.formatWithCount(5, forms)).toBe('5 apples');
    });
});

describe('List Formatter Tests', () => {
    let formatter;

    beforeEach(() => {
        formatter = createListFormatter('en-US');
    });

    it('should format with and', () => {
        const result = formatter.formatAnd(['Apple', 'Banana', 'Cherry']);
        expect(result).toContain('and');
    });

    it('should format with or', () => {
        const result = formatter.formatOr(['Red', 'Blue', 'Green']);
        expect(result).toContain('or');
    });
});

describe('Collator Tests', () => {
    let collator;

    beforeEach(() => {
        collator = createCollator('en-US');
    });

    it('should compare strings', () => {
        expect(collator.compare('a', 'b')).toBeLessThan(0);
        expect(collator.compare('b', 'a')).toBeGreaterThan(0);
    });

    it('should sort strings', () => {
        const result = collator.sort(['banana', 'Apple', 'cherry']);
        expect(result[0].toLowerCase()).toBe('apple');
    });

    it('should sort by key', () => {
        const items = [
            { name: 'Zebra' },
            { name: 'Apple' },
        ];

        const sorted = collator.sortBy(items, 'name');
        expect(sorted[0].name).toBe('Apple');
    });
});

describe('Display Names Tests', () => {
    let names;

    beforeEach(() => {
        names = createDisplayNames('en-US');
    });

    it('should get language name', () => {
        expect(names.ofLanguage('de')).toBe('German');
    });

    it('should get region name', () => {
        expect(names.ofRegion('FR')).toBe('France');
    });

    it('should get currency name', () => {
        expect(names.ofCurrency('EUR')).toBe('Euro');
    });
});
