/**
 * Currency Service
 * 
 * Multi-currency support with exchange rate management.
 * 
 * Features:
 * - Supported currencies management
 * - Exchange rate fetching (Open Exchange Rates API)
 * - Currency conversion
 * - Formatting for display
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Supported currencies (fallback if DB empty)
const DEFAULT_CURRENCIES = {
    USD: { name: 'US Dollar', symbol: '$', decimals: 2 },
    EUR: { name: 'Euro', symbol: '€', decimals: 2 },
    GBP: { name: 'British Pound', symbol: '£', decimals: 2 },
    PLN: { name: 'Polish Złoty', symbol: 'zł', decimals: 2 },
    CHF: { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
};

// Base currency for internal calculations
const BASE_CURRENCY = 'USD';

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

const CurrencyService = {
    /**
     * Get all supported currencies
     * @returns {Promise<Array>}
     */
    async getSupportedCurrencies() {
        try {
            const currencies = await dbAll(
                `SELECT code, name, symbol, decimal_places as decimals FROM supported_currencies WHERE is_active = 1`
            );

            if (currencies.length === 0) {
                return Object.entries(DEFAULT_CURRENCIES).map(([code, data]) => ({
                    code,
                    ...data
                }));
            }

            return currencies;
        } catch (error) {
            console.error('[Currency] Error fetching currencies:', error);
            return Object.entries(DEFAULT_CURRENCIES).map(([code, data]) => ({
                code,
                ...data
            }));
        }
    },

    /**
     * Get exchange rate between currencies
     * @param {string} from - Source currency code
     * @param {string} to - Target currency code
     * @returns {Promise<number>}
     */
    async getExchangeRate(from, to) {
        if (from === to) return 1.0;

        // Check cache first
        const cached = await dbGet(
            `SELECT rate, expires_at FROM exchange_rates 
             WHERE from_currency = ? AND to_currency = ? 
             AND (expires_at IS NULL OR expires_at > datetime('now'))`,
            [from, to]
        );

        if (cached) {
            return cached.rate;
        }

        // Fetch fresh rate
        const rate = await this._fetchExchangeRate(from, to);

        // Cache it
        await this._cacheExchangeRate(from, to, rate);

        return rate;
    },

    /**
     * Convert amount between currencies
     * @param {number} amount - Amount in source currency (in smallest unit, e.g., cents)
     * @param {string} from - Source currency
     * @param {string} to - Target currency
     * @returns {Promise<{amount: number, rate: number}>}
     */
    async convertAmount(amount, from, to) {
        if (from === to) {
            return { amount, rate: 1.0 };
        }

        const rate = await this.getExchangeRate(from, to);
        const convertedAmount = Math.round(amount * rate);

        return { amount: convertedAmount, rate };
    },

    /**
     * Format amount for display
     * @param {number} amount - Amount in smallest unit (cents)
     * @param {string} currency - Currency code
     * @param {string} locale - Locale for formatting (default: 'en-US')
     * @returns {string}
     */
    formatAmount(amount, currency, locale = 'en-US') {
        const currencies = DEFAULT_CURRENCIES;
        const currencyInfo = currencies[currency] || { decimals: 2 };

        const value = amount / Math.pow(10, currencyInfo.decimals);

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: currencyInfo.decimals,
                maximumFractionDigits: currencyInfo.decimals,
            }).format(value);
        } catch (error) {
            // Fallback formatting
            const symbol = currencyInfo.symbol || currency;
            return `${symbol}${value.toFixed(currencyInfo.decimals)}`;
        }
    },

    /**
     * Parse formatted amount to cents
     * @param {string|number} value - Amount value
     * @param {string} currency - Currency code
     * @returns {number} - Amount in smallest unit
     */
    parseAmount(value, currency) {
        const currencies = DEFAULT_CURRENCIES;
        const currencyInfo = currencies[currency] || { decimals: 2 };

        const numericValue = typeof value === 'string'
            ? parseFloat(value.replace(/[^0-9.-]/g, ''))
            : value;

        return Math.round(numericValue * Math.pow(10, currencyInfo.decimals));
    },

    /**
     * Update exchange rates from API (run via cron)
     */
    async updateExchangeRates() {
        console.log('[Currency] Updating exchange rates...');

        const apiKey = process.env.OPENEXCHANGERATES_API_KEY;
        if (!apiKey) {
            console.warn('[Currency] No API key configured, using fallback rates');
            await this._useFallbackRates();
            return;
        }

        try {
            const response = await fetch(
                `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
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

            console.log(`[Currency] Updated ${supported.length} exchange rates`);
        } catch (error) {
            console.error('[Currency] Failed to update rates:', error);
            await this._useFallbackRates();
        }
    },

    /**
     * Get currency info
     * @param {string} code 
     */
    async getCurrencyInfo(code) {
        const currency = await dbGet(
            `SELECT code, name, symbol, decimal_places as decimals FROM supported_currencies WHERE code = ?`,
            [code]
        );

        return currency || DEFAULT_CURRENCIES[code] || null;
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    async _fetchExchangeRate(from, to) {
        // Try API first
        const apiKey = process.env.OPENEXCHANGERATES_API_KEY;

        if (apiKey) {
            try {
                // Get USD-based rates
                const response = await fetch(
                    `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`
                );

                if (response.ok) {
                    const data = await response.json();
                    const rates = data.rates;

                    // Convert via USD
                    const fromRate = from === 'USD' ? 1 : (1 / rates[from]);
                    const toRate = to === 'USD' ? 1 : rates[to];

                    return fromRate * toRate;
                }
            } catch (error) {
                console.error('[Currency] API fetch failed:', error);
            }
        }

        // Use fallback rates
        return this._getFallbackRate(from, to);
    },

    _getFallbackRate(from, to) {
        // Hardcoded fallback rates (USD base)
        const usdRates = {
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
    },

    async _useFallbackRates() {
        const usdRates = {
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
    },

    async _cacheExchangeRate(from, to, rate) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

        await dbRun(
            `INSERT OR REPLACE INTO exchange_rates (id, from_currency, to_currency, rate, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), from, to, rate, expiresAt]
        );
    },
};

module.exports = CurrencyService;
