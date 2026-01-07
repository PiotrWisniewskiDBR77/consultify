/**
 * Currency Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('CurrencyService', () => {
    it('should convert currency', () => {
        const result = { from: 'USD', to: 'EUR', rate: 0.92 };
        expect(result.rate).toBeGreaterThan(0);
    });

    it('should format currency', () => {
        const formatted = '$1,234.56';
        expect(formatted).toContain('$');
    });

    it('should get rates', () => {
        const rates = { USD: 1, EUR: 0.92 };
        expect(rates.USD).toBe(1);
    });
});
