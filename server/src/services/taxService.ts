/**
 * Tax Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles tax calculations, VAT validation, and Stripe Tax integration.
 * Fully migrated from server/services/taxService.js
 *
 * Features:
 * - Tax rate management (CRUD)
 * - Tax calculation based on customer location
 * - VAT number validation (VIES, Stripe)
 * - Tax reports
 * - Supports EU VAT, US Sales Tax, and other jurisdictions
 */

import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface TaxRate {
    id: string;
    stripe_tax_rate_id?: string | null;
    display_name: string;
    description?: string | null;
    jurisdiction?: string | null;
    jurisdiction_level?: string | null;
    percentage: number;
    inclusive: number; // 0 or 1
    tax_type: string;
    country?: string | null;
    state?: string | null;
    postal_codes?: string; // JSON string
    product_categories?: string; // JSON string
    is_active: number; // 0 or 1
    effective_from?: string | null;
    effective_until?: string | null;
    stripe_tax_code?: string | null;
    automatic_tax: number; // 0 or 1
    created_at: string;
    updated_at: string;
}

interface TaxRateCreateData {
    stripe_tax_rate_id?: string;
    display_name: string;
    description?: string;
    jurisdiction?: string;
    jurisdiction_level?: string;
    percentage: number;
    inclusive?: boolean;
    tax_type: string;
    country?: string;
    state?: string;
    postal_codes?: string[];
    product_categories?: string[];
    is_active?: boolean;
    effective_from?: string;
    effective_until?: string;
    stripe_tax_code?: string;
    automatic_tax?: boolean;
}

interface TaxRateUpdateData {
    display_name?: string;
    description?: string;
    jurisdiction?: string;
    jurisdiction_level?: string;
    percentage?: number;
    inclusive?: boolean;
    tax_type?: string;
    country?: string;
    state?: string;
    postal_codes?: string[];
    product_categories?: string[];
    is_active?: boolean;
    effective_from?: string;
    effective_until?: string;
    stripe_tax_code?: string;
    automatic_tax?: boolean;
}

interface TaxCalculationOptions {
    amount: number; // in cents
    currency?: string;
    country: string;
    state?: string | null;
    postalCode?: string | null;
    taxIdNumber?: string | null;
    useStripeTax?: boolean;
}

interface TaxCalculationResult {
    taxAmount: number;
    taxRate: number;
    taxType: string | null;
    taxBehavior: 'exclusive' | 'inclusive' | 'reverse_charge' | 'none';
    description: string;
    taxRateId?: string;
    stripeTaxCalculationId?: string;
    breakdown: Array<{
        name?: string;
        rate: number;
        amount: number;
    }>;
}

interface VATValidationResult {
    is_valid: boolean;
    company_name?: string | null;
    company_address?: string | null;
    validation_source?: string;
    cached?: boolean;
    error?: string;
}

interface TaxReportOptions {
    startDate?: string;
    endDate?: string;
    groupBy?: 'country' | 'tax_type' | 'month';
}

interface TaxReportData {
    period: { startDate?: string; endDate?: string };
    groupBy: string;
    data: Array<{
        country?: string;
        tax_type?: string;
        month?: string;
        invoice_count: number;
        subtotal: number;
        tax_collected: number;
        total: number;
        avg_tax_rate?: number;
    }>;
    totals: {
        invoice_count: number;
        subtotal: number;
        tax_collected: number;
        total: number;
    };
}

interface TaxServiceDependencies {
    db?: IDatabase;
    stripe?: Stripe | null;
}

// ==========================================
// TAX SERVICE CLASS
// ==========================================

class TaxServiceClass {
    private db: IDatabase;
    private stripe: Stripe | null;

    constructor(deps?: TaxServiceDependencies) {
        this.db = deps?.db || getDatabase();
        this.stripe =
            deps?.stripe ||
            (process.env.STRIPE_SECRET_KEY
                ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as any })
                : null);
    }

    /**
     * Database helper: Get all rows
     */
    private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all<T>(sql, params, (err: Error | null, rows: unknown) => {
                if (err) reject(err);
                else resolve((rows as T[]) || []);
            });
        });
    }

    /**
     * Database helper: Get single row
     */
    private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        return new Promise((resolve, reject) => {
            this.db.get<T>(sql, params, (err: Error | null, row: unknown) => {
                if (err) reject(err);
                else resolve((row as T) || null);
            });
        });
    }

    /**
     * Database helper: Run query
     */
    private async dbRun(sql: string, params: unknown[] = []): Promise<{ lastID?: number; changes: number }> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes || 0 });
            });
        });
    }

    // ==========================================
    // TAX RATE MANAGEMENT
    // ==========================================

    /**
     * Get all tax rates
     */
    async getTaxRates(
        options: { country?: string; taxType?: string; isActive?: boolean | null } = {},
    ): Promise<TaxRate[]> {
        const { country, taxType, isActive = true } = options;

        let query = 'SELECT * FROM tax_rates WHERE 1=1';
        const params: unknown[] = [];

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

        return await this.dbAll<TaxRate>(query, params);
    }

    /**
     * Get tax rate by ID
     */
    async getTaxRateById(taxRateId: string): Promise<TaxRate | null> {
        return await this.dbGet<TaxRate>('SELECT * FROM tax_rates WHERE id = ?', [taxRateId]);
    }

    /**
     * Create a new tax rate
     */
    async createTaxRate(data: TaxRateCreateData): Promise<TaxRate & TaxRateCreateData> {
        const id = `tax-${uuidv4()}`;
        await this.dbRun(
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
                data.automatic_tax ? 1 : 0,
            ],
        );

        return { id, ...data } as TaxRate & TaxRateCreateData;
    }

    /**
     * Update tax rate
     */
    async updateTaxRate(
        taxRateId: string,
        updates: TaxRateUpdateData,
    ): Promise<{ id: string; changes: number } | null> {
        const fields: string[] = [];
        const values: unknown[] = [];

        const allowedFields: Array<keyof TaxRateUpdateData> = [
            'display_name',
            'description',
            'jurisdiction',
            'jurisdiction_level',
            'percentage',
            'inclusive',
            'tax_type',
            'country',
            'state',
            'postal_codes',
            'product_categories',
            'is_active',
            'effective_from',
            'effective_until',
            'stripe_tax_code',
            'automatic_tax',
        ];

        allowedFields.forEach((field) => {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`);
                if (field === 'postal_codes' || field === 'product_categories') {
                    values.push(JSON.stringify(updates[field]));
                } else if (field === 'inclusive' || field === 'is_active' || field === 'automatic_tax') {
                    values.push((updates[field] as boolean) ? 1 : 0);
                } else {
                    values.push(updates[field]);
                }
            }
        });

        if (fields.length === 0) return null;

        fields.push('updated_at = datetime("now")');
        values.push(taxRateId);

        const result = await this.dbRun(`UPDATE tax_rates SET ${fields.join(', ')} WHERE id = ?`, values);

        return { id: taxRateId, changes: result.changes };
    }

    /**
     * Delete tax rate (soft delete)
     */
    async deleteTaxRate(taxRateId: string): Promise<{ id: string; changes: number } | null> {
        return this.updateTaxRate(taxRateId, { is_active: false });
    }

    /**
     * Get tax rates for a specific country
     */
    async getTaxRatesForCountry(countryCode: string): Promise<TaxRate[]> {
        return await this.dbAll<TaxRate>(
            `SELECT * FROM tax_rates 
             WHERE country = ? AND is_active = 1
             AND (effective_from IS NULL OR effective_from <= datetime('now'))
             AND (effective_until IS NULL OR effective_until >= datetime('now'))
             ORDER BY percentage DESC`,
            [countryCode],
        );
    }

    // ==========================================
    // TAX CALCULATION
    // ==========================================

    /**
     * Calculate tax for an amount based on customer location
     */
    async calculateTax(options: TaxCalculationOptions): Promise<TaxCalculationResult> {
        const {
            amount,
            currency = 'USD',
            country,
            state = null,
            postalCode = null,
            taxIdNumber = null,
            useStripeTax = false,
        } = options;

        // If tax ID is provided, validate it first
        if (taxIdNumber && country) {
            const validation = await this.validateVATNumber(taxIdNumber, country);
            if (validation.is_valid && this.isEUCountry(country)) {
                // EU B2B reverse charge - 0% VAT
                return {
                    taxAmount: 0,
                    taxRate: 0,
                    taxType: 'vat',
                    taxBehavior: 'reverse_charge',
                    description: 'EU Reverse Charge (B2B)',
                    breakdown: [
                        {
                            name: 'EU Reverse Charge',
                            rate: 0,
                            amount: 0,
                        },
                    ],
                };
            }
        }

        // Use Stripe Tax if enabled and available
        if (useStripeTax && this.stripe) {
            try {
                const taxCalc = await this.stripe.tax.calculations.create({
                    currency,
                    line_items: [
                        {
                            amount,
                            reference: 'calculation',
                        },
                    ],
                    customer_details: {
                        address: {
                            country,
                            state: state || undefined,
                            postal_code: postalCode || undefined,
                        },
                        address_source: 'billing',
                    },
                });

                return {
                    taxAmount: taxCalc.tax_amount_exclusive,
                    taxRate: (taxCalc.tax_breakdown?.[0]?.tax_rate_details?.percentage_decimal || 0) * 100,
                    taxType: taxCalc.tax_breakdown?.[0]?.tax_rate_details?.tax_type || 'sales_tax',
                    taxBehavior: 'exclusive',
                    description: taxCalc.tax_breakdown?.[0]?.tax_rate_details?.display_name || 'Tax',
                    stripeTaxCalculationId: taxCalc.id,
                    breakdown: (taxCalc.tax_breakdown || []).map((tb) => ({
                        name: tb.tax_rate_details?.display_name,
                        rate: (tb.tax_rate_details?.percentage_decimal || 0) * 100,
                        amount: tb.amount,
                    })),
                };
            } catch (e: unknown) {
                logger.warn(
                    '[Tax] Stripe Tax calculation failed, falling back to local:',
                    e instanceof Error ? e.message : String(e),
                );
            }
        }

        // Local tax calculation
        const applicableRate = await this.findApplicableTaxRate(country, state, postalCode);

        if (!applicableRate) {
            return {
                taxAmount: 0,
                taxRate: 0,
                taxType: null,
                taxBehavior: 'none',
                description: 'No applicable tax',
                breakdown: [],
            };
        }

        const taxAmount = applicableRate.inclusive
            ? Math.round(amount - amount / (1 + applicableRate.percentage / 100))
            : Math.round(amount * (applicableRate.percentage / 100));

        return {
            taxAmount,
            taxRate: applicableRate.percentage,
            taxType: applicableRate.tax_type,
            taxBehavior: applicableRate.inclusive ? 'inclusive' : 'exclusive',
            taxRateId: applicableRate.id,
            description: applicableRate.display_name,
            breakdown: [
                {
                    name: applicableRate.display_name,
                    rate: applicableRate.percentage,
                    amount: taxAmount,
                },
            ],
        };
    }

    /**
     * Find applicable tax rate for location
     */
    private async findApplicableTaxRate(
        country: string,
        _state: string | null = null,
        _postalCode: string | null = null,
    ): Promise<TaxRate | null> {
        // Try to find most specific match first
        let query = `
            SELECT * FROM tax_rates 
            WHERE is_active = 1 
            AND (effective_from IS NULL OR effective_from <= datetime('now'))
            AND (effective_until IS NULL OR effective_until >= datetime('now'))
        `;
        const params: unknown[] = [];

        if (country) {
            query += ` AND (country = ? OR country IS NULL)`;
            params.push(country);
        }

        query += ` ORDER BY 
            CASE WHEN country IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN state IS NOT NULL THEN 0 ELSE 1 END,
            percentage DESC
            LIMIT 1`;

        return await this.dbGet<TaxRate>(query, params);
    }

    // ==========================================
    // VAT VALIDATION
    // ==========================================

    /**
     * Validate VAT number using VIES or Stripe
     */
    async validateVATNumber(vatNumber: string, countryCode: string): Promise<VATValidationResult> {
        // Clean the VAT number
        const cleanedNumber = vatNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();

        // Check cache first
        const cached = await this.getCachedValidation(cleanedNumber, countryCode);
        if (cached && new Date(cached.expires_at) > new Date()) {
            return {
                is_valid: cached.is_valid === 1,
                company_name: cached.company_name,
                company_address: cached.company_address,
                cached: true,
            };
        }

        // Try Stripe Tax ID validation first
        if (this.stripe) {
            try {
                const validation = await this.stripe.tax.validations.create({
                    type: this.mapCountryToTaxIdType(countryCode),
                    value: cleanedNumber,
                });

                const result: VATValidationResult = {
                    is_valid: validation.status === 'valid',
                    company_name: validation.owner?.name || null,
                    company_address: validation.owner?.address?.line1 || null,
                    validation_source: 'stripe',
                };

                await this.cacheValidation(cleanedNumber, countryCode, result);
                return result;
            } catch (e: unknown) {
                logger.warn('[Tax] Stripe validation failed:', { message: e instanceof Error ? e.message : String(e) } as any);
            }
        }

        // Fallback to VIES for EU countries
        if (this.isEUCountry(countryCode)) {
            try {
                const viesResult = await this.validateWithVIES(cleanedNumber, countryCode);
                await this.cacheValidation(cleanedNumber, countryCode, viesResult);
                return viesResult;
            } catch (e: unknown) {
                logger.warn('[Tax] VIES validation failed:', { message: e instanceof Error ? e.message : String(e) } as any);
            }
        }

        // Return unverified if all methods fail
        return {
            is_valid: false,
            error: 'Could not validate VAT number',
            validation_source: 'none',
        };
    }

    /**
     * Validate with EU VIES service (mock implementation)
     */
    private async validateWithVIES(vatNumber: string, countryCode: string): Promise<VATValidationResult> {
        // In production, this would call the actual VIES SOAP service
        // For now, return a mock response
        logger.info(`[Tax] VIES validation for ${countryCode}${vatNumber}`, {} as any);

        // Basic format validation
        const formatValid = /^[A-Z0-9]{8,12}$/.test(vatNumber);

        return {
            is_valid: formatValid,
            company_name: formatValid ? 'Company Name (VIES lookup required)' : null,
            company_address: formatValid ? 'Address (VIES lookup required)' : null,
            validation_source: 'vies_mock',
        };
    }

    /**
     * Cache validation result
     */
    private async cacheValidation(vatNumber: string, countryCode: string, result: VATValidationResult): Promise<void> {
        const id = `vat-${uuidv4()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Cache for 7 days

        await this.dbRun(
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
                JSON.stringify(result),
            ],
        );
    }

    /**
     * Get cached validation
     */
    private async getCachedValidation(
        vatNumber: string,
        countryCode: string,
    ): Promise<{
        is_valid: number;
        company_name?: string | null;
        company_address?: string | null;
        expires_at: string;
    } | null> {
        return await this.dbGet<{
            is_valid: number;
            company_name?: string | null;
            company_address?: string | null;
            expires_at: string;
        }>('SELECT * FROM vat_validations WHERE vat_number = ? AND country_code = ?', [vatNumber, countryCode]);
    }

    // ==========================================
    // TAX REPORTS
    // ==========================================

    /**
     * Generate tax report for a period
     */
    async getTaxReport(options: TaxReportOptions = {}): Promise<TaxReportData> {
        const {
            startDate,
            endDate,
            groupBy = 'country', // country, tax_type, month
        } = options;

        let query: string;
        const params: unknown[] = [];

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

        const rows = await this.dbAll<{
            country?: string;
            tax_type?: string;
            month?: string;
            invoice_count: number;
            subtotal: number;
            tax_collected: number;
            total: number;
            avg_tax_rate?: number;
        }>(query, params);

        return {
            period: { startDate, endDate },
            groupBy,
            data: rows,
            totals: this.calculateTotals(rows),
        };
    }

    /**
     * Calculate totals from report data
     */
    private calculateTotals(
        rows: Array<{ invoice_count?: number; subtotal?: number; tax_collected?: number; total?: number }>,
    ): {
        invoice_count: number;
        subtotal: number;
        tax_collected: number;
        total: number;
    } {
        return rows.reduce(
            (acc, row) => ({
                invoice_count: acc.invoice_count + (row.invoice_count || 0),
                subtotal: acc.subtotal + (row.subtotal || 0),
                tax_collected: acc.tax_collected + (row.tax_collected || 0),
                total: acc.total + (row.total || 0),
            }),
            { invoice_count: 0, subtotal: 0, tax_collected: 0, total: 0 },
        );
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    /**
     * Check if country is in EU
     */
    isEUCountry(countryCode: string | null | undefined): boolean {
        const euCountries = [
            'AT',
            'BE',
            'BG',
            'HR',
            'CY',
            'CZ',
            'DK',
            'EE',
            'FI',
            'FR',
            'DE',
            'GR',
            'HU',
            'IE',
            'IT',
            'LV',
            'LT',
            'LU',
            'MT',
            'NL',
            'PL',
            'PT',
            'RO',
            'SK',
            'SI',
            'ES',
            'SE',
        ];
        return euCountries.includes(countryCode?.toUpperCase() || '');
    }

    /**
     * Map country code to Stripe tax ID type
     */
    mapCountryToTaxIdType(countryCode: string | null | undefined): string {
        const mapping: Record<string, string> = {
            AT: 'eu_vat',
            BE: 'eu_vat',
            BG: 'eu_vat',
            HR: 'eu_vat',
            CY: 'eu_vat',
            CZ: 'eu_vat',
            DK: 'eu_vat',
            EE: 'eu_vat',
            FI: 'eu_vat',
            FR: 'eu_vat',
            DE: 'eu_vat',
            GR: 'eu_vat',
            HU: 'eu_vat',
            IE: 'eu_vat',
            IT: 'eu_vat',
            LV: 'eu_vat',
            LT: 'eu_vat',
            LU: 'eu_vat',
            MT: 'eu_vat',
            NL: 'eu_vat',
            PL: 'eu_vat',
            PT: 'eu_vat',
            RO: 'eu_vat',
            SK: 'eu_vat',
            SI: 'eu_vat',
            ES: 'eu_vat',
            SE: 'eu_vat',
            GB: 'gb_vat',
            CH: 'ch_vat',
            US: 'us_ein',
            CA: 'ca_bn',
            AU: 'au_abn',
            NZ: 'nz_gst',
        };
        return mapping[countryCode?.toUpperCase() || ''] || 'eu_vat';
    }
}

// ==========================================
// EXPORTS
// ==========================================

// Export singleton instance (for backward compatibility)
const taxService = new TaxServiceClass();

// Export class for testing
export { TaxServiceClass };

// Export default instance
export default taxService;

// Export individual methods for backward compatibility
export const getTaxRates = (options?: { country?: string; taxType?: string; isActive?: boolean | null }) =>
    taxService.getTaxRates(options);
export const getTaxRateById = (taxRateId: string) => taxService.getTaxRateById(taxRateId);
export const createTaxRate = (data: TaxRateCreateData) => taxService.createTaxRate(data);
export const updateTaxRate = (taxRateId: string, updates: TaxRateUpdateData) =>
    taxService.updateTaxRate(taxRateId, updates);
export const deleteTaxRate = (taxRateId: string) => taxService.deleteTaxRate(taxRateId);
export const getTaxRatesForCountry = (countryCode: string) => taxService.getTaxRatesForCountry(countryCode);
export const calculateTax = (options: TaxCalculationOptions) => taxService.calculateTax(options);
export const findApplicableTaxRate = (country: string, state?: string | null, postalCode?: string | null) =>
    taxService['findApplicableTaxRate'](country, state, postalCode);
export const validateVATNumber = (vatNumber: string, countryCode: string) =>
    taxService.validateVATNumber(vatNumber, countryCode);
export const getTaxReport = (options?: TaxReportOptions) => taxService.getTaxReport(options);
export const isEUCountry = (countryCode: string | null | undefined) => taxService.isEUCountry(countryCode);
export const mapCountryToTaxIdType = (countryCode: string | null | undefined) =>
    taxService.mapCountryToTaxIdType(countryCode);
