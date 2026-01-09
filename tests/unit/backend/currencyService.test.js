/**
 * Currency Service Unit Tests
 * Tests currency conversion, formatting, and exchange rates
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Currency Service implementation
const createCurrencyService = () => {
    const rates = new Map([
        ['USD', 1],
        ['EUR', 0.92],
        ['GBP', 0.79],
        ['PLN', 4.02],
        ['JPY', 149.50]
    ]);

    return {
        getRates: () => Object.fromEntries(rates),

        getRate: (from, to) => {
            const fromRate = rates.get(from);
            const toRate = rates.get(to);
            if (!fromRate || !toRate) return null;
            return toRate / fromRate;
        },

        convert: function (amount, from, to) {
            const fromRate = rates.get(from);
            const toRate = rates.get(to);
            if (!fromRate || !toRate) throw new Error('Invalid currency');
            const calculatedRate = toRate / fromRate;
            return {
                amount: parseFloat((amount * calculatedRate).toFixed(2)),
                from,
                to,
                rate: calculatedRate
            };
        },

        format: (amount, currency, locale = 'en-US') => {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency
            }).format(amount);
        },

        updateRate: (currency, rate) => {
            rates.set(currency, rate);
        },

        getSupportedCurrencies: () => Array.from(rates.keys()),

        isSupported: (currency) => rates.has(currency),

        formatCompact: (amount, currency) => {
            const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency,
                notation: 'compact',
                maximumFractionDigits: 1
            });
            return formatter.format(amount);
        }
    };
};

describe('CurrencyService', () => {
    let currencyService;

    beforeEach(() => {
        currencyService = createCurrencyService();
    });

    describe('Exchange Rates', () => {
        it('should get all rates', () => {
            const rates = currencyService.getRates();
            expect(rates.USD).toBe(1);
            expect(rates.EUR).toBeDefined();
        });

        it('should get specific rate', () => {
            const rate = currencyService.getRate('USD', 'EUR');
            expect(rate).toBeCloseTo(0.92, 2);
        });

        it('should update rate', () => {
            currencyService.updateRate('EUR', 0.95);
            expect(currencyService.getRates().EUR).toBe(0.95);
        });
    });

    describe('Currency Conversion', () => {
        it('should convert currency', () => {
            const result = currencyService.convert(100, 'USD', 'EUR');

            expect(result.amount).toBeCloseTo(92, 0);
            expect(result.from).toBe('USD');
            expect(result.to).toBe('EUR');
        });

        it('should handle reverse conversion', () => {
            const result = currencyService.convert(100, 'EUR', 'USD');
            expect(result.amount).toBeGreaterThan(100);
        });

        it('should throw for unsupported currency', () => {
            expect(() => currencyService.convert(100, 'USD', 'XXX'))
                .toThrow('Invalid currency');
        });
    });

    describe('Formatting', () => {
        it('should format currency', () => {
            const formatted = currencyService.format(1234.56, 'USD');
            expect(formatted).toContain('$');
            expect(formatted).toContain('1,234.56');
        });

        it('should format with locale', () => {
            const formatted = currencyService.format(1234.56, 'EUR', 'de-DE');
            expect(formatted).toContain('€');
        });

        it('should format compact', () => {
            const formatted = currencyService.formatCompact(1500000, 'USD');
            expect(formatted).toContain('M');
        });
    });

    describe('Currency Support', () => {
        it('should list supported currencies', () => {
            const currencies = currencyService.getSupportedCurrencies();
            expect(currencies).toContain('USD');
            expect(currencies).toContain('EUR');
        });

        it('should check if currency is supported', () => {
            expect(currencyService.isSupported('USD')).toBe(true);
            expect(currencyService.isSupported('FAKE')).toBe(false);
        });
    });
});
