/**
 * Token Billing Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles 3-tier token billing:
 * 1. Platform Tokens - Purchased from us with margin
 * 2. BYOK Tokens - User's own API keys with usage fee
 * 3. Local Tokens - Self-hosted LLMs with minimal fee
 *
 * Migrated from server/services/tokenBillingService.js
 */

import * as crypto from 'crypto';

import * as sqliteAsync from '../../db/sqliteAsync.js';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';

// ==========================================
// TYPES
// ==========================================

interface TokenBillingServiceDeps {
    db: IDatabase;
    uuidv4: () => string;
    crypto: typeof crypto;
    sqliteAsync: typeof sqliteAsync;
}

interface BillingMargin {
    source_type: string;
    base_cost_per_1k: number;
    margin_percent: number;
    min_charge: number;
    is_active: boolean;
}

interface TokenPackage {
    id: string;
    name: string;
    description: string;
    tokens: number;
    price_usd: number;
    bonus_percent: number;
    is_popular: boolean;
    sort_order: number;
    stripe_price_id: string | null;
}

interface UserBalance {
    user_id: string;
    platform_tokens: number;
    platform_tokens_bonus: number;
    byok_usage_tokens: number;
    local_usage_tokens: number;
}

interface OrgBalance {
    balance: number;
    billingStatus: string;
    organizationType: string;
}

// Encryption key for API keys (should be in env)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'default-32-char-key-for-dev-only!';
const IV_LENGTH = 16;

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class TokenBillingServiceClass {
    #deps: TokenBillingServiceDeps | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor(deps?: Partial<TokenBillingServiceDeps>) {
        if (deps?.db && deps?.uuidv4 && deps?.crypto) {
            this.#deps = deps as TokenBillingServiceDeps;
            this.#initialized = true;
        }
    }

    async #initDeps() {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            const [uuidModule] = await Promise.all([import('uuid')]);

            this.#deps = {
                db: getDatabase(),
                uuidv4: uuidModule.v4,
                crypto,
                sqliteAsync,
            };
            this.#initialized = true;
        })();

        return this.#initPromise;
    }

    setDependencies(newDeps: Partial<TokenBillingServiceDeps>) {
        this.#deps = { ...this.#deps!, ...newDeps };
        this.#initialized = true;
    }

    private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
        await this.#initDeps();
        return DbPromise.get<T>(this.#deps!.db, sql, params, { fallback: false });
    }

    private async dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
        await this.#initDeps();
        const result = await DbPromise.run(this.#deps!.db, sql, params, { fallback: false });
        return {
            lastID: result.lastID,
            changes: result.changes || 0,
        };
    }

    private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        await this.#initDeps();
        return DbPromise.all<T>(this.#deps!.db, sql, params, { fallback: false });
    }

    // ==========================================
    // MARGIN MANAGEMENT
    // ==========================================

    async getMargins(): Promise<BillingMargin[]> {
        return this.dbAll<BillingMargin>('SELECT * FROM billing_margins ORDER BY source_type');
    }

    async getMargin(sourceType: string): Promise<BillingMargin | null> {
        return this.dbGet<BillingMargin>('SELECT * FROM billing_margins WHERE source_type = ?', [sourceType]);
    }

    async updateMargin(
        sourceType: string,
        {
            baseCostPer1k,
            marginPercent,
            minCharge,
            isActive,
        }: { baseCostPer1k?: number; marginPercent?: number; minCharge?: number; isActive?: boolean },
    ): Promise<{ changes: number }> {
        const result = await this.dbRun(
            `UPDATE billing_margins 
             SET base_cost_per_1k = COALESCE(?, base_cost_per_1k),
                 margin_percent = COALESCE(?, margin_percent),
                 min_charge = COALESCE(?, min_charge),
                 is_active = COALESCE(?, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE source_type = ?`,
            [baseCostPer1k, marginPercent, minCharge, isActive, sourceType],
        );
        return { changes: result.changes };
    }

    // ==========================================
    // TOKEN PACKAGES
    // ==========================================

    async getPackages(): Promise<TokenPackage[]> {
        return this.dbAll<TokenPackage>('SELECT * FROM token_packages WHERE is_active = 1 ORDER BY sort_order');
    }

    async getPackage(packageId: string): Promise<TokenPackage | null> {
        return this.dbGet<TokenPackage>('SELECT * FROM token_packages WHERE id = ?', [packageId]);
    }

    async upsertPackage(pkg: {
        id?: string;
        name: string;
        description?: string;
        tokens: number;
        priceUsd: number;
        bonusPercent?: number;
        isPopular?: boolean;
        sortOrder?: number;
        stripePriceId?: string;
    }): Promise<{ id: string }> {
        await this.#initDeps();
        const { uuidv4 } = this.#deps!;

        const packageId = pkg.id || `pkg-${uuidv4().slice(0, 8)}`;
        await this.dbRun(
            `INSERT INTO token_packages (id, name, description, tokens, price_usd, bonus_percent, is_popular, sort_order, stripe_price_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name, description = excluded.description, tokens = excluded.tokens,
                 price_usd = excluded.price_usd, bonus_percent = excluded.bonus_percent,
                 is_popular = excluded.is_popular, sort_order = excluded.sort_order, stripe_price_id = excluded.stripe_price_id`,
            [
                packageId,
                pkg.name,
                pkg.description,
                pkg.tokens,
                pkg.priceUsd,
                pkg.bonusPercent || 0,
                pkg.isPopular ? 1 : 0,
                pkg.sortOrder || 0,
                pkg.stripePriceId,
            ],
        );
        return { id: packageId };
    }

    // ==========================================
    // USER BALANCE
    // ==========================================

    async getBalance(userId: string): Promise<UserBalance> {
        const row = await this.dbGet<UserBalance>('SELECT * FROM user_token_balance WHERE user_id = ?', [userId]);
        return (
            row || {
                user_id: userId,
                platform_tokens: 0,
                platform_tokens_bonus: 0,
                byok_usage_tokens: 0,
                local_usage_tokens: 0,
            }
        );
    }

    async ensureBalance(userId: string): Promise<{ userId: string }> {
        await this.dbRun(`INSERT OR IGNORE INTO user_token_balance (user_id) VALUES (?)`, [userId]);
        return { userId };
    }

    async hasSufficientBalance(userId: string, requiredTokens: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        return (balance.platform_tokens || 0) + (balance.platform_tokens_bonus || 0) >= requiredTokens;
    }

    // ==========================================
    // TOKEN OPERATIONS
    // ==========================================

    async creditTokens(
        userId: string,
        tokens: number,
        bonusTokens: number = 0,
        options: { packageId?: string; stripePaymentId?: string; organizationId?: string } = {},
    ): Promise<{ transactionId: string; tokens: number; bonusTokens: number }> {
        const { packageId, stripePaymentId, organizationId } = options;
        await this.ensureBalance(userId);

        await this.#initDeps();
        const { db, uuidv4 } = this.#deps!;

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(
                    `UPDATE user_token_balance SET platform_tokens = platform_tokens + ?, platform_tokens_bonus = platform_tokens_bonus + ?, lifetime_purchased = lifetime_purchased + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                    [tokens, bonusTokens, tokens + bonusTokens, userId],
                );

                const txId = `tx-${uuidv4()}`;

                // 1. Log Transaction
                db.run(
                    `INSERT INTO token_transactions (id, user_id, organization_id, type, source_type, tokens, package_id, stripe_payment_id, description) VALUES (?, ?, ?, 'purchase', 'platform', ?, ?, ?, ?)`,
                    [
                        txId,
                        userId,
                        organizationId,
                        tokens + bonusTokens,
                        packageId,
                        stripePaymentId,
                        `Purchased ${tokens} tokens`,
                    ],
                    function (err: Error | null) {
                        if (err) return reject(err);

                        // 2. Generate Invoice Record if Organization ID is present
                        if (organizationId) {
                            // Fetch Package Price to log invoice correctly
                            db.get(
                                'SELECT price_usd FROM token_packages WHERE id = ?',
                                [packageId],
                                (err: Error | null, row: any) => {
                                    if (row && row.price_usd > 0) {
                                        const invoiceId = `inv-${uuidv4().slice(0, 8)}`;
                                        db.run(
                                            `INSERT INTO billing_invoices (id, organization_id, amount_due, currency, status, stripe_invoice_id, created_at) VALUES (?, ?, ?, 'USD', 'paid', ?, CURRENT_TIMESTAMP)`,
                                            [
                                                invoiceId,
                                                organizationId,
                                                row.price_usd,
                                                stripePaymentId || 'manual_credit',
                                            ],
                                        );
                                    }
                                },
                            );
                        }

                        resolve({ transactionId: txId, tokens, bonusTokens });
                    },
                );
            });
        });
    }

    async deductTokens(
        userId: string,
        tokens: number,
        sourceType: string,
        options: { organizationId?: string; llmProvider?: string; modelUsed?: string; multiplier?: number } = {},
    ): Promise<{ transactionId: string; tokens: number; marginUsd: number }> {
        const { organizationId, llmProvider, modelUsed, multiplier } = options;
        await this.ensureBalance(userId);
        await this.#initDeps();
        const { db, uuidv4 } = this.#deps!;

        // 1. Calculate Billed Amount
        const margin = await this.getMargin(sourceType);
        const baseCostPer1k = margin?.base_cost_per_1k || 0;
        const marginPercent = margin?.margin_percent || 0;
        const minCharge = margin?.min_charge || 0;

        // Apply Markup Multiplier (Default 1.0)
        const finalMultiplier = multiplier || 1.0;
        const billedTokens = Math.ceil(tokens * finalMultiplier);

        let marginUsd = 0;
        if (sourceType === 'platform') {
            const baseCost = (billedTokens / 1000) * baseCostPer1k;
            marginUsd = baseCost * (marginPercent / 100);
        } else {
            const estimatedValue = (billedTokens / 1000) * 0.01; // Estimated cost valuation
            marginUsd = estimatedValue * (marginPercent / 100);
        }
        marginUsd = Math.max(marginUsd, minCharge);

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 2. DEDUCTION LOGIC
                if (organizationId && sourceType === 'platform') {
                    // Org-Level Deduction
                    db.run(
                        `UPDATE organizations 
                         SET token_balance = MAX(0, IFNULL(token_balance, 0) - ?) 
                         WHERE id = ?`,
                        [billedTokens, organizationId],
                        (err: Error | null) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                        },
                    );
                } else {
                    // User-Level Deduction
                    const field =
                        sourceType === 'platform'
                            ? 'platform_tokens'
                            : sourceType === 'byok'
                              ? 'byok_usage_tokens'
                              : 'local_usage_tokens';
                    const op =
                        sourceType === 'platform' ? `${field} = MAX(0, ${field} - ?)` : `${field} = ${field} + ?`;

                    db.run(
                        `UPDATE user_token_balance SET ${op}, lifetime_used = lifetime_used + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                        [billedTokens, billedTokens, userId],
                        (err: Error | null) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                        },
                    );
                }

                // 3. LOG TRANSACTION
                const txId = `tx-${uuidv4()}`;
                const metadata = JSON.stringify({ raw_tokens: tokens, multiplier: finalMultiplier });

                db.run(
                    `INSERT INTO token_transactions (id, user_id, organization_id, type, source_type, tokens, margin_usd, net_revenue_usd, llm_provider, model_used, description, metadata) VALUES (?, ?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        txId,
                        userId,
                        organizationId,
                        sourceType,
                        -billedTokens,
                        marginUsd,
                        marginUsd,
                        llmProvider,
                        modelUsed,
                        `Used ${tokens} tokens (x${finalMultiplier}) via ${sourceType}`,
                        metadata,
                    ],
                    (err: Error | null) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        // 4. LOG TO TOKEN_LEDGER
                        if (organizationId) {
                            const ledgerId = `led-${uuidv4()}`;
                            const ledgerMeta = JSON.stringify({
                                raw_tokens: tokens,
                                multiplier: finalMultiplier,
                                llm_provider: llmProvider,
                                model_used: modelUsed,
                                margin_usd: marginUsd,
                            });
                            db.run(
                                `INSERT INTO token_ledger (id, organization_id, actor_user_id, actor_type, type, amount, reason, ref_entity_type, ref_entity_id, metadata_json)
                                 VALUES (?, ?, ?, 'USER', 'DEBIT', ?, ?, 'AI_CALL', ?, ?)`,
                                [
                                    ledgerId,
                                    organizationId,
                                    userId,
                                    billedTokens,
                                    `AI Call: ${modelUsed || 'unknown'}`,
                                    txId,
                                    ledgerMeta,
                                ],
                                (ledgerErr: Error | null) => {
                                    if (ledgerErr) {
                                        console.error('Token Ledger Insert Error (non-fatal):', ledgerErr);
                                    }
                                    // Use callback for COMMIT to ensure order
                                    db.run('COMMIT', [], (commitErr: Error | null) => {
                                        if (commitErr) return reject(commitErr);
                                        resolve({ transactionId: txId, tokens: billedTokens, marginUsd });
                                    });
                                },
                            );
                        } else {
                            db.run('COMMIT', [], (commitErr: Error | null) => {
                                if (commitErr) return reject(commitErr);
                                resolve({ transactionId: txId, tokens: billedTokens, marginUsd });
                            });
                        }
                    },
                );
            });
        });
    }

    // ==========================================
    // ENCRYPTION
    // ==========================================

    encryptApiKey(apiKey: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(apiKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    decryptApiKey(encryptedKey: string): string {
        const [ivHex, encrypted] = encryptedKey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // ==========================================
    // ORGANIZATION BALANCE
    // ==========================================

    async getOrgBalance(orgId: string): Promise<OrgBalance> {
        const row = await this.dbGet<any>(
            `SELECT token_balance, billing_status, organization_type FROM organizations WHERE id = ?`,
            [orgId],
        );
        if (!row) throw new Error('Organization not found');
        return {
            balance: row.token_balance || 0,
            billingStatus: row.billing_status || 'TRIAL',
            organizationType: row.organization_type || 'TRIAL',
        };
    }

    async hasOrgSufficientBalance(
        orgId: string,
        estimatedTokens: number,
    ): Promise<{ allowed: boolean; balance: number; reason?: string; paygoTriggered?: boolean }> {
        let org;
        try {
            org = await this.getOrgBalance(orgId);
        } catch (err: unknown) {
            return { allowed: false, balance: 0, reason: 'Balance check failed. Please retry.' };
        }

        const { balance, billingStatus, organizationType } = org;
        const isTrial = billingStatus === 'TRIAL' || organizationType === 'TRIAL';

        if (isTrial && balance < estimatedTokens) {
            return {
                allowed: false,
                balance,
                reason: 'Trial token limit reached. Upgrade to continue using AI features.',
            };
        }

        if (!isTrial && billingStatus === 'ACTIVE' && balance < estimatedTokens) {
            return { allowed: true, balance, paygoTriggered: true };
        }

        return { allowed: true, balance };
    }
    // ==========================================
    // LEDGER OPERATIONS
    // ==========================================

    async getLedger(orgId: string, options: { limit?: number; offset?: number } = {}): Promise<any[]> {
        const { limit = 50, offset = 0 } = options;
        return this.dbAll(
            `SELECT 
                id, created_at, actor_user_id, actor_type, type, amount, reason, 
                ref_entity_type, ref_entity_id, metadata_json
             FROM token_ledger 
             WHERE organization_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [orgId, limit, offset],
        );
    }

    async getLedgerSummary(
        orgId: string,
    ): Promise<{ totalCredits: number; totalDebits: number; computedBalance: number; transactionCount: number }> {
        const row = await this.dbGet<any>(
            `SELECT 
                SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as total_credits,
                SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
                COUNT(*) as transaction_count
             FROM token_ledger 
             WHERE organization_id = ?`,
            [orgId],
        );
        return {
            totalCredits: row?.total_credits || 0,
            totalDebits: row?.total_debits || 0,
            computedBalance: (row?.total_credits || 0) - (row?.total_debits || 0),
            transactionCount: row?.transaction_count || 0,
        };
    }

    async creditOrganization(
        orgId: string,
        tokens: number,
        options: {
            userId?: string | null;
            reason?: string;
            refType?: string;
            refId?: string | null;
            metadata?: any;
        } = {},
    ): Promise<{ ledgerId: string; tokens: number; orgId: string }> {
        const { userId = null, reason = 'Credit', refType = 'GRANT', refId = null, metadata = {} } = options;
        await this.#initDeps();
        const ledgerId = `led-${this.#deps!.uuidv4()}`;
        const metadataJson = JSON.stringify(metadata);

        return this.#deps!.sqliteAsync.withTransaction(this.#deps!.db, async () => {
            const upd = await this.#deps!.sqliteAsync.runAsync(
                this.#deps!.db,
                `UPDATE organizations SET token_balance = IFNULL(token_balance, 0) + ? WHERE id = ?`,
                [tokens, orgId],
            );
            if (upd.changes === 0) throw new Error('Organization not found');

            await this.#deps!.sqliteAsync.runAsync(
                this.#deps!.db,
                `INSERT INTO token_ledger (id, organization_id, actor_user_id, actor_type, type, amount, reason, ref_entity_type, ref_entity_id, metadata_json)
                  VALUES (?, ?, ?, ?, 'CREDIT', ?, ?, ?, ?, ?)`,
                [ledgerId, orgId, userId, userId ? 'USER' : 'SYSTEM', tokens, reason, refType, refId, metadataJson],
            );

            return { ledgerId, tokens, orgId };
        });
    }
}

// ==========================================
// EXPORTS
// ==========================================

const TokenBillingService = new TokenBillingServiceClass();

export default TokenBillingService;
