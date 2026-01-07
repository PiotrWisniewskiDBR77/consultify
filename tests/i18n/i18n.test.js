/**
 * Internationalization (i18n) Tests
 * Tests for i18n message handling
 * 
 * @module tests/i18n/i18n.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// i18n implementation
const createI18n = (options = {}) => {
    const { defaultLocale = 'en', fallbackLocale = 'en' } = options;
    const messages = new Map();
    let currentLocale = defaultLocale;
    const listeners = [];

    const emit = () => {
        listeners.forEach(fn => fn(currentLocale));
    };

    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((acc, part) => acc?.[part], obj);
    };

    const interpolate = (message, params) => {
        if (!params) return message;

        return message.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    };

    return {
        addMessages: (locale, msgs) => {
            const existing = messages.get(locale) || {};
            messages.set(locale, { ...existing, ...msgs });
        },

        setLocale: (locale) => {
            if (!messages.has(locale) && locale !== fallbackLocale) {
                console.warn(`Locale ${locale} not found, using fallback`);
            }
            currentLocale = locale;
            emit();
        },

        getLocale: () => currentLocale,

        t: (key, params) => {
            // Try current locale
            let message = getNestedValue(messages.get(currentLocale), key);

            // Try fallback
            if (message === undefined && currentLocale !== fallbackLocale) {
                message = getNestedValue(messages.get(fallbackLocale), key);
            }

            // Return key if not found
            if (message === undefined) {
                return key;
            }

            return interpolate(String(message), params);
        },

        tc: (key, count, params) => {
            const rules = getNestedValue(messages.get(currentLocale), key) ||
                getNestedValue(messages.get(fallbackLocale), key);

            if (!rules) return key;

            // Simple pluralization: { one: '...', other: '...' }
            let message;
            if (count === 0 && rules.zero) {
                message = rules.zero;
            } else if (count === 1 && rules.one) {
                message = rules.one;
            } else if (rules.other) {
                message = rules.other;
            } else {
                message = rules;
            }

            return interpolate(String(message), { count, ...params });
        },

        exists: (key) => {
            const current = getNestedValue(messages.get(currentLocale), key);
            const fallback = getNestedValue(messages.get(fallbackLocale), key);
            return current !== undefined || fallback !== undefined;
        },

        getAvailableLocales: () => [...messages.keys()],

        onLocaleChange: (callback) => {
            listeners.push(callback);
            return () => {
                const index = listeners.indexOf(callback);
                if (index !== -1) listeners.splice(index, 1);
            };
        },
    };
};

// Number formatter
const createNumberFormatter = (locale = 'en') => {
    return {
        format: (number, options = {}) => {
            const { style = 'decimal', currency, minimumFractionDigits, maximumFractionDigits } = options;

            const formatter = new Intl.NumberFormat(locale, {
                style,
                currency,
                minimumFractionDigits,
                maximumFractionDigits,
            });

            return formatter.format(number);
        },

        formatCurrency: (amount, currency = 'USD') => {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
            }).format(amount);
        },

        formatPercent: (value) => {
            return new Intl.NumberFormat(locale, {
                style: 'percent',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(value);
        },

        formatCompact: (number) => {
            return new Intl.NumberFormat(locale, {
                notation: 'compact',
            }).format(number);
        },

        setLocale: (newLocale) => {
            locale = newLocale;
        },
    };
};

// Date formatter
const createDateFormatter = (locale = 'en') => {
    return {
        format: (date, options = {}) => {
            const d = date instanceof Date ? date : new Date(date);
            return new Intl.DateTimeFormat(locale, options).format(d);
        },

        formatDate: (date) => {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }).format(new Date(date));
        },

        formatTime: (date) => {
            return new Intl.DateTimeFormat(locale, {
                hour: 'numeric',
                minute: 'numeric',
            }).format(new Date(date));
        },

        formatDateTime: (date) => {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            }).format(new Date(date));
        },

        formatRelative: (date) => {
            const now = Date.now();
            const diff = new Date(date).getTime() - now;
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

        setLocale: (newLocale) => {
            locale = newLocale;
        },
    };
};

describe('i18n Tests', () => {
    let i18n;

    beforeEach(() => {
        i18n = createI18n({ defaultLocale: 'en' });
        i18n.addMessages('en', {
            greeting: 'Hello',
            welcome: 'Welcome, {name}!',
            nested: {
                message: 'Nested message',
            },
            items: {
                zero: 'No items',
                one: 'One item',
                other: '{count} items',
            },
        });
        i18n.addMessages('pl', {
            greeting: 'Cześć',
            welcome: 'Witaj, {name}!',
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TRANSLATION
    // ═══════════════════════════════════════════════════════════════════

    describe('translation', () => {
        it('should translate simple key', () => {
            expect(i18n.t('greeting')).toBe('Hello');
        });

        it('should translate with interpolation', () => {
            expect(i18n.t('welcome', { name: 'John' })).toBe('Welcome, John!');
        });

        it('should translate nested keys', () => {
            expect(i18n.t('nested.message')).toBe('Nested message');
        });

        it('should return key if not found', () => {
            expect(i18n.t('unknown.key')).toBe('unknown.key');
        });

        it('should use fallback locale', () => {
            i18n.setLocale('pl');
            expect(i18n.t('nested.message')).toBe('Nested message');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PLURALIZATION
    // ═══════════════════════════════════════════════════════════════════

    describe('pluralization', () => {
        it('should handle zero', () => {
            expect(i18n.tc('items', 0)).toBe('No items');
        });

        it('should handle one', () => {
            expect(i18n.tc('items', 1)).toBe('One item');
        });

        it('should handle other', () => {
            expect(i18n.tc('items', 5)).toBe('5 items');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOCALE
    // ═══════════════════════════════════════════════════════════════════

    describe('locale', () => {
        it('should change locale', () => {
            i18n.setLocale('pl');

            expect(i18n.getLocale()).toBe('pl');
            expect(i18n.t('greeting')).toBe('Cześć');
        });

        it('should notify on locale change', () => {
            const handler = vi.fn();
            i18n.onLocaleChange(handler);

            i18n.setLocale('pl');

            expect(handler).toHaveBeenCalledWith('pl');
        });

        it('should list available locales', () => {
            expect(i18n.getAvailableLocales()).toContain('en');
            expect(i18n.getAvailableLocales()).toContain('pl');
        });

        it('should check if key exists', () => {
            expect(i18n.exists('greeting')).toBe(true);
            expect(i18n.exists('unknown')).toBe(false);
        });
    });
});

describe('Number Formatter Tests', () => {
    let formatter;

    beforeEach(() => {
        formatter = createNumberFormatter('en-US');
    });

    it('should format number', () => {
        const result = formatter.format(1234567.89);
        expect(result).toContain('1,234,567');
    });

    it('should format currency', () => {
        const result = formatter.formatCurrency(99.99, 'USD');
        expect(result).toContain('$');
        expect(result).toContain('99.99');
    });

    it('should format percent', () => {
        const result = formatter.formatPercent(0.75);
        expect(result).toContain('75');
        expect(result).toContain('%');
    });

    it('should format compact', () => {
        const result = formatter.formatCompact(1500000);
        expect(result).toContain('M') || expect(result.toLowerCase()).toContain('m');
    });
});

describe('Date Formatter Tests', () => {
    let formatter;
    const testDate = new Date('2025-01-07T12:30:00');

    beforeEach(() => {
        formatter = createDateFormatter('en-US');
    });

    it('should format date', () => {
        const result = formatter.formatDate(testDate);
        expect(result).toContain('January');
        expect(result).toContain('7');
        expect(result).toContain('2025');
    });

    it('should format time', () => {
        const result = formatter.formatTime(testDate);
        expect(result).toContain('12');
        expect(result).toContain('30');
    });

    it('should format datetime', () => {
        const result = formatter.formatDateTime(testDate);
        expect(result).toContain('January');
        expect(result).toContain('12');
    });

    it('should format relative time', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = formatter.formatRelative(yesterday);
        expect(result.toLowerCase()).toContain('yesterday') || expect(result).toContain('1 day');
    });
});
