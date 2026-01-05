/**
 * Currency Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Multi-currency support with exchange rate management.
 * Fully migrated from server/services/currencyService.js
 *
 * Features:
 * - Supported currencies management
 * - Exchange rate fetching (Open Exchange Rates API)
 * - Currency conversion
 * - Formatting for display
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface CurrencyInfo {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
}

interface ExchangeRateCache {
    rate: number;
    expires_at: string | null;
}

interface ConvertAmountResult {
    amount: number;
    rate: number;
}

interface CurrencyServiceDependencies {
    db?: IDatabase;
}

// ==========================================
// CONSTANTS
// ==========================================

const DEFAULT_CURRENCIES: Record<string, CurrencyInfo> = {
    USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
    EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
    GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
    PLN: { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', decimals: 2 },
    CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
};

const _BASE_CURRENCY = 'USD';

// ==========================================
// CURRENCY SERVICE CLASS
// ==========================================

class CurrencyServiceClass {
    private _db: IDatabase;

    constructor(deps?: CurrencyServiceDependencies) {
        this._db = deps?.db || getDatabase();
    }

    /**
     * Database helper: Get single row
     */
    private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        return await DbPromise.get<T>(sql, params);
    }

    /**
     * Database helper: Run query
     */
    private async dbRun(sql: string, params: unknown[] = []): Promise<{ lastID?: number; changes: number }> {
        const result = await DbPromise.run(sql, params);
        return {
            lastID: result.lastID,
            changes: result.changes || 0,
        };
    }

    /**
     * Database helper: Get all rows
     */
    private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return await DbPromise.all<T>(sql, params);
    }

    /**
     * Get all supported currencies
     */
    async getSupportedCurrencies(): Promise<CurrencyInfo[]> {
        try {
            const currencies = await this.dbAll<{
                code: string;
                name: string;
                symbol: string;
                decimals: number;
            }>(`SELECT code, name, symbol, decimal_places as decimals FROM supported_currencies WHERE is_active = 1`);

            if (currencies.length === 0) {
                return Object.entries(DEFAULT_CURRENCIES).map(([_code, data]) => ({
                    ...data,
                }));
            }

            return currencies;
        } catch (error: unknown) {
            logger.error('[Currency] Error fetching currencies:', error);
            return Object.entries(DEFAULT_CURRENCIES).map(([_code, data]) => ({
                ...data,
            }));
        }
    }

    /**
     * Get exchange rate between currencies
     */
    async getExchangeRate(from: string, to: string): Promise<number> {
        if (from === to) return 1.0;

        // Check cache first
        const cached = await this.dbGet<ExchangeRateCache>(
            `SELECT rate, expires_at FROM exchange_rates 
             WHERE from_currency = ? AND to_currency = ? 
             AND (expires_at IS NULL OR expires_at > datetime('now'))`,
            [from, to],
        );

        if (cached) {
            return cached.rate;
        }

        // Fetch fresh rate
        const rate = await this._fetchExchangeRate(from, to);

        // Cache it
        await this._cacheExchangeRate(from, to, rate);

        return rate;
    }

    /**
     * Convert amount between currencies
     * @param amount - Amount in source currency (in smallest unit, e.g., cents)
     * @param from - Source currency
     * @param to - Target currency
     */
    async convertAmount(amount: number, from: string, to: string): Promise<ConvertAmountResult> {
        if (from === to) {
            return { amount, rate: 1.0 };
        }

        const rate = await this.getExchangeRate(from, to);
        const convertedAmount = Math.round(amount * rate);

        return { amount: convertedAmount, rate };
    }

    /**
     * Format amount for display
     * @param amount - Amount in smallest unit (cents)
     * @param currency - Currency code
     * @param locale - Locale for formatting (default: 'en-US')
     */
    formatAmount(amount: number, currency: string, locale = 'en-US'): string {
        const currencyInfo = DEFAULT_CURRENCIES[currency] || { decimals: 2, symbol: currency };

        const value = amount / Math.pow(10, currencyInfo.decimals);

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: currencyInfo.decimals,
                maximumFractionDigits: currencyInfo.decimals,
            }).format(value);
        } catch (error: unknown) {
            // Fallback formatting
            const symbol = currencyInfo.symbol || currency;
            return `${symbol}${value.toFixed(currencyInfo.decimals)}`;
        }
    }

    /**
     * Parse formatted amount to cents
     * @param value - Amount value
     * @param currency - Currency code
     * @returns Amount in smallest unit
     */
    parseAmount(value: string | number, currency: string): number {
        const currencyInfo = DEFAULT_CURRENCIES[currency] || { decimals: 2 };

        const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;

        return Math.round(numericValue * Math.pow(10, currencyInfo.decimals));
    }

    /**
     * Update exchange rates from API (run via cron)
     */
    async updateExchangeRates(): Promise<void> {
        logger.info('[Currency] Updating exchange rates...');

        const apiKey = process.env.OPENEXCHANGERATES_API_KEY;
        if (!apiKey) {
            logger.warn('[Currency] No API key configured, using fallback rates');
            await this._useFallbackRates();
            return;
        }

        try {
            const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = (await response.json()) as { rates: Record<string, number> };
            const rates = data.rates;

            // Update all supported currencies
            const supported = await this.getSupportedCurrencies();

            for (const currency of supported) {
                if (currency.code === 'USD') continue;

                const rate = rates[currency.code];
                if (rate) {
                    await this._cacheExchangeRate('USD', currency.code, rate);
                    // Also store reverse
                    await this._cacheExchangeRate(currency.code, 'USD', 1 / rate);
                }
            }

            logger.info(`[Currency] Updated ${supported.length} exchange rates`);
        } catch (error: unknown) {
            logger.error('[Currency] Failed to update rates:', error);
            await this._useFallbackRates();
        }
    }

    /**
     * Get currency info
     */
    async getCurrencyInfo(code: string): Promise<CurrencyInfo | null> {
        const currency = await this.dbGet<{
            code: string;
            name: string;
            symbol: string;
            decimals: number;
        }>(`SELECT code, name, symbol, decimal_places as decimals FROM supported_currencies WHERE code = ?`, [code]);

        return currency || DEFAULT_CURRENCIES[code] || null;
    }

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    private async _fetchExchangeRate(from: string, to: string): Promise<number> {
        // Try API first
        const apiKey = process.env.OPENEXCHANGERATES_API_KEY;

        if (apiKey) {
            try {
                // Get USD-based rates
                const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`);

                if (response.ok) {
                    const data = (await response.json()) as { rates: Record<string, number> };
                    const rates = data.rates;

                    // Convert via USD
                    const fromRate = from === 'USD' ? 1 : 1 / (rates[from] || 1);
                    const toRate = to === 'USD' ? 1 : rates[to] || 1;

                    return fromRate * toRate;
                }
            } catch (error: unknown) {
                logger.error('[Currency] API fetch failed:', error);
            }
        }

        // Use fallback rates
        return this._getFallbackRate(from, to);
    }

    private _getFallbackRate(from: string, to: string): number {
        // Hardcoded fallback rates (USD base)
        const usdRates: Record<string, number> = {
            USD: 1,
            EUR: 0.92,
            GBP: 0.79,
            PLN: 4.02,
            CHF: 0.88,
            CAD: 1.36,
            AUD: 1.53,
            JPY: 149.5,
        };

        const fromRate = usdRates[from] || 1;
        const toRate = usdRates[to] || 1;

        return toRate / fromRate;
    }

    private async _useFallbackRates(): Promise<void> {
        const usdRates: Record<string, number> = {
            EUR: 0.92,
            GBP: 0.79,
            PLN: 4.02,
            CHF: 0.88,
            CAD: 1.36,
            AUD: 1.53,
            JPY: 149.5,
        };

        for (const [currency, rate] of Object.entries(usdRates)) {
            await this._cacheExchangeRate('USD', currency, rate);
            await this._cacheExchangeRate(currency, 'USD', 1 / rate);
        }
    }

    private async _cacheExchangeRate(from: string, to: string, rate: number): Promise<void> {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

        await this.dbRun(
            `INSERT OR REPLACE INTO exchange_rates (id, from_currency, to_currency, rate, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), from, to, rate, expiresAt],
        );
    }
}

// ==========================================
// EXPORTS
// ==========================================

// Export singleton instance (for backward compatibility)
const currencyService = new CurrencyServiceClass();

// Export class for testing
export { CurrencyServiceClass };

// Export default instance
export default currencyService;

// Export individual methods for backward compatibility
export const getSupportedCurrencies = () => currencyService.getSupportedCurrencies();
export const getExchangeRate = (from: string, to: string) => currencyService.getExchangeRate(from, to);
export const convertAmount = (amount: number, from: string, to: string) =>
    currencyService.convertAmount(amount, from, to);
export const formatAmount = (amount: number, currency: string, locale?: string) =>
    currencyService.formatAmount(amount, currency, locale);
export const parseAmount = (value: string | number, currency: string) => currencyService.parseAmount(value, currency);
export const updateExchangeRates = () => currencyService.updateExchangeRates();
export const getCurrencyInfo = (code: string) => currencyService.getCurrencyInfo(code);
