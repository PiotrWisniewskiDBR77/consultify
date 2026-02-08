/**
 * Internationalization (i18n) - Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Internationalization (i18n)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Translation', () => {
        it('should translate simple key', () => {
            const translations: Record<string, Record<string, string>> = {
                en: { 'welcome': 'Welcome' },
                pl: { 'welcome': 'Witamy' },
                de: { 'welcome': 'Willkommen' },
            };
            const locale = 'pl';

            expect(translations[locale]['welcome']).toBe('Witamy');
        });

        it('should translate nested key', () => {
            const translations = {
                en: {
                    common: { save: 'Save', cancel: 'Cancel' },
                },
            };

            expect(translations.en.common.save).toBe('Save');
        });

        it('should interpolate variables', () => {
            const template = 'Hello, {{name}}!';
            const variables = { name: 'John' };
            const result = template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key as keyof typeof variables] || '');

            expect(result).toBe('Hello, John!');
        });

        it('should handle pluralization', () => {
            const pluralize = (count: number, singular: string, plural: string) =>
                count === 1 ? singular : plural;

            expect(pluralize(1, 'item', 'items')).toBe('item');
            expect(pluralize(5, 'item', 'items')).toBe('items');
        });

        it('should handle complex pluralization', () => {
            const translations = {
                items: {
                    zero: 'No items',
                    one: '1 item',
                    few: '{{count}} items', // 2-4
                    many: '{{count}} items', // 5+
                },
            };

            const getPluralForm = (count: number) => {
                if (count === 0) return translations.items.zero;
                if (count === 1) return translations.items.one;
                return translations.items.many.replace('{{count}}', String(count));
            };

            expect(getPluralForm(0)).toBe('No items');
            expect(getPluralForm(1)).toBe('1 item');
            expect(getPluralForm(5)).toBe('5 items');
        });

        it('should fallback to default locale', () => {
            const translations: Record<string, Record<string, string>> = {
                en: { 'hello': 'Hello', 'goodbye': 'Goodbye' },
                de: { 'hello': 'Hallo' },
            };
            const locale = 'de';
            const fallbackLocale = 'en';
            const key = 'goodbye';

            const translation = translations[locale][key] || translations[fallbackLocale][key];

            expect(translation).toBe('Goodbye');
        });

        it('should return key if not found', () => {
            const translations: Record<string, Record<string, string>> = { en: {} };
            const key = 'missing.key';
            const translation = translations['en'][key] || key;

            expect(translation).toBe('missing.key');
        });
    });

    describe('Date Formatting', () => {
        it('should format date for locale', () => {
            const date = new Date('2024-01-15');
            const formats: Record<string, Intl.DateTimeFormatOptions> = {
                short: { day: '2-digit', month: '2-digit', year: 'numeric' },
                long: { day: 'numeric', month: 'long', year: 'numeric' },
            };

            const formatted = date.toLocaleDateString('en-US', formats.long);

            expect(formatted).toContain('January');
        });

        it('should format relative date', () => {
            const formatRelative = (date: Date) => {
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffDays === 0) return 'Today';
                if (diffDays === 1) return 'Yesterday';
                if (diffDays < 7) return `${diffDays} days ago`;
                return date.toLocaleDateString();
            };

            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

            expect(formatRelative(yesterday)).toBe('Yesterday');
        });

        it('should format time for locale', () => {
            const date = new Date('2024-01-15T14:30:00');
            const time = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });

            expect(time).toContain(':');
        });
    });

    describe('Number Formatting', () => {
        it('should format number for locale', () => {
            const number = 1234567.89;
            const formatted = number.toLocaleString('de-DE');

            expect(formatted).toContain('.');
        });

        it('should format currency', () => {
            const amount = 1234.56;
            const formatted = amount.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
            });

            expect(formatted).toBe('$1,234.56');
        });

        it('should format percentage', () => {
            const value = 0.75;
            const formatted = value.toLocaleString('en-US', {
                style: 'percent',
            });

            expect(formatted).toBe('75%');
        });

        it('should format compact numbers', () => {
            const formatCompact = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                return String(num);
            };

            expect(formatCompact(1500000)).toBe('1.5M');
            expect(formatCompact(2500)).toBe('2.5K');
        });
    });

    describe('RTL Support', () => {
        it('should detect RTL language', () => {
            const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
            const language = 'ar';
            const isRTL = rtlLanguages.includes(language);

            expect(isRTL).toBe(true);
        });

        it('should set text direction', () => {
            const isRTL = true;
            const direction = isRTL ? 'rtl' : 'ltr';

            expect(direction).toBe('rtl');
        });
    });

    describe('Locale Detection', () => {
        it('should parse Accept-Language header', () => {
            const header = 'en-US,en;q=0.9,pl;q=0.8';
            const locales = header.split(',').map((part) => {
                const [locale, q] = part.split(';q=');
                return { locale: locale.trim(), q: q ? parseFloat(q) : 1 };
            });

            expect(locales[0].locale).toBe('en-US');
            expect(locales[0].q).toBe(1);
        });

        it('should match supported locale', () => {
            const supported = ['en', 'de', 'pl', 'es'];
            const preferred = ['fr', 'de', 'en'];
            const matched = preferred.find((p) => supported.includes(p));

            expect(matched).toBe('de');
        });

        it('should fallback to default locale', () => {
            const supported = ['en', 'de', 'pl'];
            const preferred = ['fr', 'it'];
            const defaultLocale = 'en';
            const matched = preferred.find((p) => supported.includes(p)) || defaultLocale;

            expect(matched).toBe('en');
        });
    });

    describe('Translation Keys', () => {
        it('should generate keys from context', () => {
            const context = { module: 'projects', action: 'create' };
            const key = `${context.module}.${context.action}.title`;

            expect(key).toBe('projects.create.title');
        });

        it('should validate key format', () => {
            const validKeyPattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

            expect(validKeyPattern.test('common.button.save')).toBe(true);
            expect(validKeyPattern.test('Invalid Key')).toBe(false);
        });
    });
});

describe('Localization Utilities', () => {
    describe('Language Files', () => {
        it('should load language file', () => {
            const loadLanguage = (locale: string) => {
                const files: Record<string, Record<string, string>> = {
                    en: { greeting: 'Hello' },
                    pl: { greeting: 'Cześć' },
                };
                return files[locale] || null;
            };

            expect(loadLanguage('pl')?.greeting).toBe('Cześć');
        });

        it('should merge language files', () => {
            const common = { save: 'Save', cancel: 'Cancel' };
            const module = { title: 'Projects', create: 'Create Project' };
            const merged = { ...common, ...module };

            expect(Object.keys(merged)).toHaveLength(4);
        });
    });

    describe('Missing Translations', () => {
        it('should track missing translations', () => {
            const missing: string[] = [];
            const translations: Record<string, string> = { hello: 'Hello' };

            const t = (key: string) => {
                if (!(key in translations)) {
                    missing.push(key);
                    return key;
                }
                return translations[key];
            };

            t('hello');
            t('missing.key');

            expect(missing).toContain('missing.key');
        });

        it('should report missing translations', () => {
            const report = {
                locale: 'de',
                missingKeys: ['common.save', 'projects.title'],
                coverage: 95.5,
            };

            expect(report.missingKeys).toHaveLength(2);
        });
    });
});
