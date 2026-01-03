/**
 * Tax Service
 * Handles tax calculations, VAT validation, and Stripe Tax integration
 * Supports EU VAT, US Sales Tax, and other jurisdictions
 */

const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

// Stripe initialization
let stripe = null;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
} catch (e) {
    console.log('[Tax] Stripe not initialized');
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

// ==========================================
// TAX RATE MANAGEMENT
// ==========================================

/**
 * Get all tax rates
 */
function getTaxRates(options = {}) {
    const { country, taxType, isActive = true } = options;
    
    let query = 'SELECT * FROM tax_rates WHERE 1=1';
    const params = [];
    
    if (isActive !== null) {
        query += ' AND is_active = ?';
        params.push(isActive ? 1 : 0);
    }
    
    if (country) {
        query += ' AND country = ?';
        params.push(country);
    }
    
    if (taxType) {
        query += ' AND tax_type = ?';
        params.push(taxType);
    }
    
    query += ' ORDER BY country, percentage DESC';

    return new Promise((resolve, reject) => {
        deps.db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Get tax rate by ID
 */
function getTaxRateById(taxRateId) {
    return new Promise((resolve, reject) => {
        deps.db.get('SELECT * FROM tax_rates WHERE id = ?', [taxRateId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Create a new tax rate
 */
function createTaxRate(data) {
    const id = `tax-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO tax_rates (
                id, stripe_tax_rate_id, display_name, description, jurisdiction, jurisdiction_level,
                percentage, inclusive, tax_type, country, state, postal_codes, product_categories,
                is_active, effective_from, effective_until, stripe_tax_code, automatic_tax
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                data.stripe_tax_rate_id || null,
                data.display_name,
                data.description || null,
                data.jurisdiction || null,
                data.jurisdiction_level || null,
                data.percentage,
                data.inclusive ? 1 : 0,
                data.tax_type,
                data.country || null,
                data.state || null,
                JSON.stringify(data.postal_codes || []),
                JSON.stringify(data.product_categories || []),
                data.is_active !== false ? 1 : 0,
                data.effective_from || null,
                data.effective_until || null,
                data.stripe_tax_code || null,
                data.automatic_tax ? 1 : 0
            ],
            function(err) {
                if (err) reject(err);
                else resolve({ id, ...data });
            }
        );
    });
}

/**
 * Update tax rate
 */
function updateTaxRate(taxRateId, updates) {
    const fields = [];
    const values = [];
    
    const allowedFields = [
        'display_name', 'description', 'jurisdiction', 'jurisdiction_level',
        'percentage', 'inclusive', 'tax_type', 'country', 'state',
        'postal_codes', 'product_categories', 'is_active', 'effective_from',
        'effective_until', 'stripe_tax_code', 'automatic_tax'
    ];

    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            if (field === 'postal_codes' || field === 'product_categories') {
                values.push(JSON.stringify(updates[field]));
            } else if (field === 'inclusive' || field === 'is_active' || field === 'automatic_tax') {
                values.push(updates[field] ? 1 : 0);
            } else {
                values.push(updates[field]);
            }
        }
    });

    if (fields.length === 0) return Promise.resolve(null);

    fields.push('updated_at = datetime("now")');
    values.push(taxRateId);

    return new Promise((resolve, reject) => {
        deps.db.run(
            `UPDATE tax_rates SET ${fields.join(', ')} WHERE id = ?`,
            values,
            function(err) {
                if (err) reject(err);
                else resolve({ id: taxRateId, changes: this.changes });
            }
        );
    });
}

/**
 * Delete tax rate (soft delete)
 */
function deleteTaxRate(taxRateId) {
    return updateTaxRate(taxRateId, { is_active: false });
}

// ==========================================
// TAX CALCULATION
// ==========================================

/**
 * Calculate tax for an amount based on customer location
 * @param {Object} options - Calculation options
 * @param {number} options.amount - Amount in cents
 * @param {string} options.currency - Currency code
 * @param {string} options.country - Customer country code
 * @param {string} [options.state] - Customer state/province
 * @param {string} [options.postalCode] - Customer postal code
 * @param {string} [options.taxIdNumber] - Customer VAT/Tax ID
 * @param {boolean} [options.useStripeTax] - Use Stripe Tax for calculation
 */
async function calculateTax(options) {
    const {
        amount,
        currency = 'USD',
        country,
        state = null,
        postalCode = null,
        taxIdNumber = null,
        useStripeTax = false
    } = options;

    // If tax ID is provided, validate it first
    if (taxIdNumber && country) {
        const validation = await validateVATNumber(taxIdNumber, country);
        if (validation.is_valid && isEUCountry(country)) {
            // EU B2B reverse charge - 0% VAT
            return {
                taxAmount: 0,
                taxRate: 0,
                taxType: 'vat',
                taxBehavior: 'reverse_charge',
                description: 'EU Reverse Charge (B2B)',
                breakdown: [{
                    name: 'EU Reverse Charge',
                    rate: 0,
                    amount: 0
                }]
            };
        }
    }

    // Use Stripe Tax if enabled and available
    if (useStripeTax && stripe) {
        try {
            const taxCalc = await stripe.tax.calculations.create({
                currency,
                line_items: [{
                    amount,
                    reference: 'calculation'
                }],
                customer_details: {
                    address: {
                        country,
                        state,
                        postal_code: postalCode
                    },
                    address_source: 'billing'
                }
            });

            return {
                taxAmount: taxCalc.tax_amount_exclusive,
                taxRate: taxCalc.tax_breakdown?.[0]?.tax_rate_details?.percentage_decimal * 100 || 0,
                taxType: taxCalc.tax_breakdown?.[0]?.tax_rate_details?.tax_type || 'sales_tax',
                taxBehavior: 'exclusive',
                stripeTaxCalculationId: taxCalc.id,
                breakdown: taxCalc.tax_breakdown?.map(tb => ({
                    name: tb.tax_rate_details?.display_name,
                    rate: tb.tax_rate_details?.percentage_decimal * 100,
                    amount: tb.amount
                })) || []
            };
        } catch (e) {
            console.warn('[Tax] Stripe Tax calculation failed, falling back to local:', e.message);
        }
    }

    // Local tax calculation
    const applicableRate = await findApplicableTaxRate(country, state, postalCode);
    
    if (!applicableRate) {
        return {
            taxAmount: 0,
            taxRate: 0,
            taxType: null,
            taxBehavior: 'none',
            description: 'No applicable tax',
            breakdown: []
        };
    }

    const taxAmount = applicableRate.inclusive
        ? Math.round(amount - (amount / (1 + applicableRate.percentage / 100)))
        : Math.round(amount * (applicableRate.percentage / 100));

    return {
        taxAmount,
        taxRate: applicableRate.percentage,
        taxType: applicableRate.tax_type,
        taxBehavior: applicableRate.inclusive ? 'inclusive' : 'exclusive',
        taxRateId: applicableRate.id,
        description: applicableRate.display_name,
        breakdown: [{
            name: applicableRate.display_name,
            rate: applicableRate.percentage,
            amount: taxAmount
        }]
    };
}

/**
 * Find applicable tax rate for location
 */
function findApplicableTaxRate(country, state = null, postalCode = null) {
    return new Promise((resolve, reject) => {
        // Try to find most specific match first
        let query = `
            SELECT * FROM tax_rates 
            WHERE is_active = 1 
            AND (effective_from IS NULL OR effective_from <= datetime('now'))
            AND (effective_until IS NULL OR effective_until >= datetime('now'))
        `;
        const params = [];

        if (country) {
            query += ` AND (country = ? OR country IS NULL)`;
            params.push(country);
        }

        query += ` ORDER BY 
            CASE WHEN country IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN state IS NOT NULL THEN 0 ELSE 1 END,
            percentage DESC
            LIMIT 1`;

        deps.db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ==========================================
// VAT VALIDATION
// ==========================================

/**
 * Validate VAT number using VIES or Stripe
 */
async function validateVATNumber(vatNumber, countryCode) {
    // Clean the VAT number
    const cleanedNumber = vatNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Check cache first
    const cached = await getCachedValidation(cleanedNumber, countryCode);
    if (cached && new Date(cached.expires_at) > new Date()) {
        return {
            is_valid: cached.is_valid === 1,
            company_name: cached.company_name,
            company_address: cached.company_address,
            cached: true
        };
    }

    // Try Stripe Tax ID validation first
    if (stripe) {
        try {
            const validation = await stripe.tax.validations.create({
                type: mapCountryToTaxIdType(countryCode),
                value: cleanedNumber
            });

            const result = {
                is_valid: validation.status === 'valid',
                company_name: validation.owner?.name,
                company_address: validation.owner?.address?.line1,
                validation_source: 'stripe'
            };

            await cacheValidation(cleanedNumber, countryCode, result);
            return result;
        } catch (e) {
            console.warn('[Tax] Stripe validation failed:', e.message);
        }
    }

    // Fallback to VIES for EU countries
    if (isEUCountry(countryCode)) {
        try {
            const viesResult = await validateWithVIES(cleanedNumber, countryCode);
            await cacheValidation(cleanedNumber, countryCode, viesResult);
            return viesResult;
        } catch (e) {
            console.warn('[Tax] VIES validation failed:', e.message);
        }
    }

    // Return unverified if all methods fail
    return {
        is_valid: false,
        error: 'Could not validate VAT number',
        validation_source: 'none'
    };
}

/**
 * Validate with EU VIES service (mock implementation)
 */
async function validateWithVIES(vatNumber, countryCode) {
    // In production, this would call the actual VIES SOAP service
    // For now, return a mock response
    console.log(`[Tax] VIES validation for ${countryCode}${vatNumber}`);
    
    // Basic format validation
    const formatValid = /^[A-Z0-9]{8,12}$/.test(vatNumber);
    
    return {
        is_valid: formatValid,
        company_name: formatValid ? 'Company Name (VIES lookup required)' : null,
        company_address: formatValid ? 'Address (VIES lookup required)' : null,
        validation_source: 'vies_mock'
    };
}

/**
 * Cache validation result
 */
function cacheValidation(vatNumber, countryCode, result) {
    const id = `vat-${deps.uuidv4()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Cache for 7 days

    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT OR REPLACE INTO vat_validations 
             (id, vat_number, country_code, is_valid, company_name, company_address, expires_at, validation_source, raw_response)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                vatNumber,
                countryCode,
                result.is_valid ? 1 : 0,
                result.company_name,
                result.company_address,
                expiresAt.toISOString(),
                result.validation_source,
                JSON.stringify(result)
            ],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

/**
 * Get cached validation
 */
function getCachedValidation(vatNumber, countryCode) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT * FROM vat_validations WHERE vat_number = ? AND country_code = ?',
            [vatNumber, countryCode],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// ==========================================
// TAX REPORTS
// ==========================================

/**
 * Generate tax report for a period
 */
function getTaxReport(options = {}) {
    const {
        startDate,
        endDate,
        groupBy = 'country' // country, tax_type, month
    } = options;

    let query;
    const params = [];

    if (groupBy === 'country') {
        query = `
            SELECT 
                o.billing_country as country,
                COUNT(i.id) as invoice_count,
                SUM(i.subtotal) as subtotal,
                SUM(i.tax_amount) as tax_collected,
                SUM(i.total) as total,
                i.tax_type,
                AVG(i.tax_rate) as avg_tax_rate
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE i.status = 'paid'
        `;
    } else if (groupBy === 'tax_type') {
        query = `
            SELECT 
                i.tax_type,
                COUNT(i.id) as invoice_count,
                SUM(i.subtotal) as subtotal,
                SUM(i.tax_amount) as tax_collected,
                SUM(i.total) as total,
                AVG(i.tax_rate) as avg_tax_rate
            FROM invoices i
            WHERE i.status = 'paid'
        `;
    } else {
        query = `
            SELECT 
                strftime('%Y-%m', i.paid_at) as month,
                COUNT(i.id) as invoice_count,
                SUM(i.subtotal) as subtotal,
                SUM(i.tax_amount) as tax_collected,
                SUM(i.total) as total
            FROM invoices i
            WHERE i.status = 'paid'
        `;
    }

    if (startDate) {
        query += ` AND i.paid_at >= ?`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND i.paid_at <= ?`;
        params.push(endDate);
    }

    if (groupBy === 'country') {
        query += ` GROUP BY o.billing_country, i.tax_type ORDER BY tax_collected DESC`;
    } else if (groupBy === 'tax_type') {
        query += ` GROUP BY i.tax_type ORDER BY tax_collected DESC`;
    } else {
        query += ` GROUP BY month ORDER BY month DESC`;
    }

    return new Promise((resolve, reject) => {
        deps.db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve({
                period: { startDate, endDate },
                groupBy,
                data: rows || [],
                totals: calculateTotals(rows || [])
            });
        });
    });
}

/**
 * Calculate totals from report data
 */
function calculateTotals(rows) {
    return rows.reduce((acc, row) => ({
        invoice_count: acc.invoice_count + (row.invoice_count || 0),
        subtotal: acc.subtotal + (row.subtotal || 0),
        tax_collected: acc.tax_collected + (row.tax_collected || 0),
        total: acc.total + (row.total || 0)
    }), { invoice_count: 0, subtotal: 0, tax_collected: 0, total: 0 });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if country is in EU
 */
function isEUCountry(countryCode) {
    const euCountries = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];
    return euCountries.includes(countryCode?.toUpperCase());
}

/**
 * Map country code to Stripe tax ID type
 */
function mapCountryToTaxIdType(countryCode) {
    const mapping = {
        'AT': 'eu_vat', 'BE': 'eu_vat', 'BG': 'eu_vat', 'HR': 'eu_vat',
        'CY': 'eu_vat', 'CZ': 'eu_vat', 'DK': 'eu_vat', 'EE': 'eu_vat',
        'FI': 'eu_vat', 'FR': 'eu_vat', 'DE': 'eu_vat', 'GR': 'eu_vat',
        'HU': 'eu_vat', 'IE': 'eu_vat', 'IT': 'eu_vat', 'LV': 'eu_vat',
        'LT': 'eu_vat', 'LU': 'eu_vat', 'MT': 'eu_vat', 'NL': 'eu_vat',
        'PL': 'eu_vat', 'PT': 'eu_vat', 'RO': 'eu_vat', 'SK': 'eu_vat',
        'SI': 'eu_vat', 'ES': 'eu_vat', 'SE': 'eu_vat',
        'GB': 'gb_vat',
        'CH': 'ch_vat',
        'US': 'us_ein',
        'CA': 'ca_bn',
        'AU': 'au_abn',
        'NZ': 'nz_gst'
    };
    return mapping[countryCode?.toUpperCase()] || 'eu_vat';
}

/**
 * Get tax rates for a specific country
 */
function getTaxRatesForCountry(countryCode) {
    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT * FROM tax_rates 
             WHERE country = ? AND is_active = 1
             AND (effective_from IS NULL OR effective_from <= datetime('now'))
             AND (effective_until IS NULL OR effective_until >= datetime('now'))
             ORDER BY percentage DESC`,
            [countryCode],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

module.exports = {
    setDependencies,
    // Tax Rates
    getTaxRates,
    getTaxRateById,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
    getTaxRatesForCountry,
    // Tax Calculation
    calculateTax,
    findApplicableTaxRate,
    // VAT Validation
    validateVATNumber,
    // Reports
    getTaxReport,
    // Helpers
    isEUCountry,
    mapCountryToTaxIdType
};




