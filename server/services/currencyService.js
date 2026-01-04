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

const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/Database.ts');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
}

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
async function dbGet(sql, params = []) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function dbRun(sql, params = []) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function dbAll(sql, params = []) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

const getSupportedCurrencies = async () => {
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
};

const getExchangeRate = async (from, to) => {
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
    const rate = await _fetchExchangeRate(from, to);

    // Cache it
    await _cacheExchangeRate(from, to, rate);

    return rate;
};

const convertAmount = async (amount, from, to) => {
    if (from === to) {
        return { amount, rate: 1.0 };
    }

    const rate = await getExchangeRate(from, to);
    const convertedAmount = Math.round(amount * rate);

    return { amount: convertedAmount, rate };
};

const formatAmount = (amount, currency, locale = 'en-US') => {
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
};

const parseAmount = (value, currency) => {
    const currencies = DEFAULT_CURRENCIES;
    const currencyInfo = currencies[currency] || { decimals: 2 };

    const numericValue = typeof value === 'string'
        ? parseFloat(value.replace(/[^0-9.-]/g, ''))
        : value;

    return Math.round(numericValue * Math.pow(10, currencyInfo.decimals));
};

const updateExchangeRates = async () => {
    console.log('[Currency] Updating exchange rates...');

    const apiKey = process.env.OPENEXCHANGERATES_API_KEY;
    if (!apiKey) {
        console.warn('[Currency] No API key configured, using fallback rates');
        await _useFallbackRates();
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
        const supported = await getSupportedCurrencies();

        for (const currency of supported) {
            if (currency.code === 'USD') continue;

            const rate = rates[currency.code];
            if (rate) {
                await _cacheExchangeRate('USD', currency.code, rate);
                // Also store reverse
                await _cacheExchangeRate(currency.code, 'USD', 1 / rate);
            }
        }

        console.log(`[Currency] Updated ${supported.length} exchange rates`);
    } catch (error) {
        console.error('[Currency] Failed to update rates:', error);
        await _useFallbackRates();
    }
};

const getCurrencyInfo = async (code) => {
    const currency = await dbGet(
        `SELECT code, name, symbol, decimal_places as decimals FROM supported_currencies WHERE code = ?`,
        [code]
    );

    return currency || DEFAULT_CURRENCIES[code] || null;
};

// ==========================================
// PRIVATE METHODS
// ==========================================

async function _fetchExchangeRate(from, to) {
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
    return _getFallbackRate(from, to);
}

function _getFallbackRate(from, to) {
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
}

async function _useFallbackRates() {
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
        await _cacheExchangeRate('USD', currency, rate);
        await _cacheExchangeRate(currency, 'USD', 1 / rate);
    }
}

async function _cacheExchangeRate(from, to, rate) {
    await initDeps();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await dbRun(
        `INSERT OR REPLACE INTO exchange_rates (id, from_currency, to_currency, rate, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [deps.uuidv4(), from, to, rate, expiresAt]
    );
}

const CurrencyService = {
    getSupportedCurrencies,
    getExchangeRate,
    convertAmount,
    formatAmount,
    parseAmount,
    updateExchangeRates,
    getCurrencyInfo,
    setDependencies
};

export default CurrencyService;
